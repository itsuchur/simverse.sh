import "server-only";

import { quoteDayPassAmount } from "~/lib/day-pass-quote";
import { paymentStatus } from "~/lib/order-status";
import {
  DAY_PASS_PRESETS,
  isDayPassPreset,
  type TopupOffers,
  type TopupPackageOffer,
} from "~/lib/topup-offer";
import { db } from "~/server/db";
import { DRAFT_TTL_MS } from "~/server/orders/draft";
import {
  ESIMACCESS_SUPPLIER,
  fetchEsimAccessTopupPackages,
  getEsimAccessPackageByCode,
  retailPriceToRub,
  retailPriceToStars,
  retailPriceToUsd,
  type EsimAccessPackage,
  type EsimAccessTopupPackage,
} from "~/server/suppliers/esimaccess/packages";

// Keep a full invoice window plus a supplier-request margin before expiry.
export const TOPUP_CHECKOUT_MIN_VALIDITY_MS = DRAFT_TTL_MS + 60_000;

const TOPUP_BLOCKED_STATUSES = new Set([
  "USED_EXPIRED",
  "UNUSED_EXPIRED",
  "CANCEL",
  "REVOKED",
]);

export type TopupPurchase = {
  supplierCost: number;
  title: string;
  description: string;
  priceUsd: number;
  priceRub: number;
  draft: {
    resellerPlanId: string;
    packageName: string;
    countryCode: string | null;
    dataAmountMb: number;
    validityDays: number;
    topupOfOrderId: bigint;
    topupPeriodDays: number | null;
  };
};

function topupAllowed(
  order: {
    resellerCode: string;
    topupOfOrderId: bigint | null;
    paymentStatus: string;
    esimIccid: string | null;
    esimStatus: string | null;
    expiresAt: Date | null;
  },
  now: Date,
) {
  if (order.resellerCode !== ESIMACCESS_SUPPLIER) return false;
  if (order.topupOfOrderId !== null) return false;
  if (order.paymentStatus !== paymentStatus.paid) return false;
  if (!order.esimIccid) return false;
  if (order.esimStatus && TOPUP_BLOCKED_STATUSES.has(order.esimStatus)) {
    return false;
  }
  if (
    order.expiresAt &&
    order.expiresAt.getTime() <= now.getTime() + TOPUP_CHECKOUT_MIN_VALIDITY_MS
  )
    return false;
  return true;
}

function packageOffer(
  raw: EsimAccessTopupPackage,
  usdRubRate: number,
): TopupPackageOffer | null {
  if (
    typeof raw.packageCode !== "string" ||
    !raw.packageCode.startsWith("TOPUP_") ||
    typeof raw.name !== "string" ||
    raw.name.length === 0 ||
    typeof raw.price !== "number" ||
    !Number.isFinite(raw.price) ||
    raw.price <= 0 ||
    typeof raw.volume !== "number" ||
    !Number.isFinite(raw.volume) ||
    raw.volume < 0 ||
    typeof raw.duration !== "number" ||
    !Number.isInteger(raw.duration) ||
    raw.duration < 1
  ) {
    return null;
  }

  const retail =
    typeof raw.retailPrice === "number" &&
    Number.isFinite(raw.retailPrice) &&
    raw.retailPrice > 0
      ? raw.retailPrice
      : raw.price;

  return {
    packageCode: raw.packageCode,
    name: raw.name,
    volumeBytes: raw.volume,
    validityDays: raw.duration,
    priceUsd: retailPriceToUsd(retail),
    priceRub: retailPriceToRub(retail, usdRubRate),
    priceStars: retailPriceToStars(retail),
  };
}

/** Prefer valid Premium data top-ups, retaining standard plans when none exist. */
function preferredDataTopups(
  listed: EsimAccessTopupPackage[],
  usdRubRate: number,
) {
  const valid = listed.flatMap((raw) => {
    const offer = packageOffer(raw, usdRubRate);
    return offer ? [{ raw, offer }] : [];
  });
  const premium = valid.filter(({ offer }) => /\bPremium\b/i.test(offer.name));
  return premium.length > 0 ? premium : valid;
}

/** Identifier eSIM Access expects on /esim/topup (slug preferred). */
function topupPackageCode(raw: EsimAccessTopupPackage): string | null {
  if (typeof raw.slug === "string" && raw.slug.length > 0) return raw.slug;
  if (typeof raw.packageCode === "string" && raw.packageCode.length > 0) {
    return raw.packageCode;
  }
  return null;
}

function matchesParentPlan(
  raw: EsimAccessTopupPackage,
  pkg: EsimAccessPackage,
): boolean {
  const candidates = [raw.packageCode, raw.slug].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  const parents = [pkg.packageCode, pkg.slug].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return candidates.some((code) => parents.includes(code));
}

function resolveDayPassTopupPackage(
  listed: EsimAccessTopupPackage[],
  pkg: EsimAccessPackage,
): EsimAccessTopupPackage | null {
  const exact = listed.find((raw) => matchesParentPlan(raw, pkg));
  if (exact) return exact;

  // The ICCID top-up list omits the FUP speed segment from daily slugs.
  // Keep modifiers such as Premium so a different price tier is not selected.
  const dailySlug = pkg.slug.replace(/_\d+(?:\.\d+)?(?:Kbps|Mbps)(?=_|$)/i, "");
  if (dailySlug === pkg.slug) return null;
  return listed.find((raw) => raw.slug === dailySlug) ?? null;
}

function dayPassQuote(
  pkg: EsimAccessPackage,
  topup: EsimAccessTopupPackage,
  days: number,
) {
  const durationDays = topup.duration ?? pkg.duration;
  const cost = quoteDayPassAmount({
    retailPrice: topup.price ?? Number.NaN,
    durationDays,
    extendDays: days,
  });
  const retail = quoteDayPassAmount({
    retailPrice: topup.retailPrice ?? pkg.retailPrice,
    durationDays,
    extendDays: days,
  });
  return cost === null || retail === null ? null : { cost, retail };
}

function dayPassOffers(
  pkg: EsimAccessPackage,
  topup: EsimAccessTopupPackage,
  usdRubRate: number,
): TopupPackageOffer[] {
  const topupCode = topupPackageCode(topup);
  if (!topupCode) return [];
  const offers: TopupPackageOffer[] = [];
  for (const days of DAY_PASS_PRESETS) {
    const quote = dayPassQuote(pkg, topup, days);
    if (!quote) continue;
    offers.push({
      packageCode: topupCode,
      name: pkg.name,
      volumeBytes: pkg.volume,
      validityDays: days,
      days,
      priceUsd: retailPriceToUsd(quote.retail),
      priceRub: retailPriceToRub(quote.retail, usdRubRate),
      priceStars: retailPriceToStars(quote.retail),
    });
  }
  return offers;
}

async function ownedOrder(userId: string, orderUuid: string) {
  const order = await db.order.findUnique({ where: { orderUuid } });
  if (order?.userId !== userId) return null;
  return order;
}

export async function listTopupOffers(input: {
  userId: string;
  orderUuid: string;
}): Promise<TopupOffers | "not_found"> {
  const order = await ownedOrder(input.userId, input.orderUuid);
  if (!order) return "not_found";
  if (!topupAllowed(order, new Date()) || !order.esimIccid) {
    return { mode: "none" };
  }

  const catalog = await getEsimAccessPackageByCode(order.resellerPlanId);
  if (!catalog) return { mode: "none" };
  const { meta, pkg } = catalog;

  const listed = await fetchEsimAccessTopupPackages(order.esimIccid);

  if (pkg.supportTopUpType === 3) {
    const topup = resolveDayPassTopupPackage(listed, pkg);
    if (!topup) return { mode: "none" };
    const packages = dayPassOffers(pkg, topup, meta.usdRubRate);
    if (packages.length === 0) return { mode: "none" };
    return { mode: "packages", action: "extend", packages };
  }

  if (pkg.supportTopUpType !== 2) return { mode: "none" };

  const packages = preferredDataTopups(listed, meta.usdRubRate)
    .map(({ offer }) => offer)
    .sort((a, b) => a.priceUsd - b.priceUsd || a.volumeBytes - b.volumeBytes);

  if (packages.length === 0) return { mode: "none" };
  return { mode: "packages", action: "topup", packages };
}

export async function prepareTopupPurchase(input: {
  userId: string;
  orderUuid: string;
  packageCode?: string;
  days?: number;
}): Promise<TopupPurchase | "not_found" | "unavailable" | "invalid"> {
  const order = await ownedOrder(input.userId, input.orderUuid);
  if (!order) return "not_found";
  if (!topupAllowed(order, new Date()) || !order.esimIccid) {
    return "unavailable";
  }

  const catalog = await getEsimAccessPackageByCode(order.resellerPlanId);
  if (!catalog) return "unavailable";
  const { meta, pkg } = catalog;

  const listed = await fetchEsimAccessTopupPackages(order.esimIccid);

  if (pkg.supportTopUpType === 3) {
    if (input.days === undefined || !isDayPassPreset(input.days)) {
      return "invalid";
    }
    if (
      typeof input.packageCode !== "string" ||
      input.packageCode.length === 0
    ) {
      return "invalid";
    }
    const topup = resolveDayPassTopupPackage(listed, pkg);
    const topupCode = topup && topupPackageCode(topup);
    if (!topupCode || topupCode !== input.packageCode) return "invalid";

    const quote = dayPassQuote(pkg, topup, input.days);
    if (!quote) return "invalid";
    const dataAmountMb = Math.max(0, Math.round(pkg.volume / 1024 ** 2));
    return {
      supplierCost: quote.cost,
      title: pkg.name,
      description: `${pkg.name} · ${input.days}d`,
      priceUsd: retailPriceToUsd(quote.retail),
      priceRub: retailPriceToRub(quote.retail, meta.usdRubRate),
      draft: {
        resellerPlanId: topupCode,
        packageName: pkg.name,
        countryCode: order.countryCode,
        dataAmountMb,
        validityDays: input.days,
        topupOfOrderId: order.id,
        topupPeriodDays: input.days,
      },
    };
  }

  if (pkg.supportTopUpType !== 2 || !input.packageCode) return "invalid";

  const selected = preferredDataTopups(listed, meta.usdRubRate).find(
    ({ offer }) => offer.packageCode === input.packageCode,
  );
  if (!selected) return "invalid";
  const { raw: match, offer } = selected;
  if (typeof match.price !== "number") return "invalid";

  return {
    supplierCost: match.price,
    title: offer.name,
    description: `${offer.name} · ${offer.validityDays}d`,
    priceUsd: offer.priceUsd,
    priceRub: offer.priceRub,
    draft: {
      resellerPlanId: offer.packageCode,
      packageName: offer.name,
      countryCode: order.countryCode,
      dataAmountMb: Math.max(0, Math.round(offer.volumeBytes / 1024 ** 2)),
      validityDays: offer.validityDays,
      topupOfOrderId: order.id,
      topupPeriodDays: null,
    },
  };
}
