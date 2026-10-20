import "server-only";

import { quoteDayPassAmount } from "~/lib/day-pass-quote";
import { paymentStatus } from "~/lib/order-status";
import type { TopupOffers, TopupPackageOffer } from "~/lib/topup-offer";
import { db } from "~/server/db";
import {
  ESIMACCESS_SUPPLIER,
  fetchEsimAccessTopupPackages,
  getEsimAccessPackageByCode,
  retailPriceToRub,
  retailPriceToStars,
  retailPriceToUsd,
  type EsimAccessTopupPackage,
} from "~/server/suppliers/esimaccess/packages";

const TOPUP_BLOCKED_STATUSES = new Set([
  "USED_EXPIRED",
  "UNUSED_EXPIRED",
  "CANCEL",
  "REVOKED",
]);

const DEFAULT_EXTENSION_DAYS = 7;

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
  if (order.expiresAt && order.expiresAt.getTime() <= now.getTime())
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

async function ownedOrder(userId: string, orderUuid: string) {
  const order = await db.order.findUnique({ where: { orderUuid } });
  if (order?.userId !== userId) return null;
  return order;
}

export async function listTopupOffers(input: {
  userId: string;
  orderUuid: string;
  days?: number;
}): Promise<TopupOffers | "not_found" | "invalid_days"> {
  const order = await ownedOrder(input.userId, input.orderUuid);
  if (!order) return "not_found";
  if (!topupAllowed(order, new Date()) || !order.esimIccid) {
    return { mode: "none" };
  }

  const catalog = await getEsimAccessPackageByCode(order.resellerPlanId);
  if (!catalog) return { mode: "none" };
  const { meta, pkg } = catalog;

  if (pkg.supportTopUpType === 3) {
    const days = input.days ?? DEFAULT_EXTENSION_DAYS;
    const amount = quoteDayPassAmount({
      retailPrice: pkg.retailPrice,
      durationDays: pkg.duration,
      extendDays: days,
    });
    if (amount === null) return "invalid_days";
    if (!pkg.slug) return { mode: "none" };
    return {
      mode: "validity",
      days,
      priceUsd: retailPriceToUsd(amount),
      priceRub: retailPriceToRub(amount, meta.usdRubRate),
      priceStars: retailPriceToStars(amount),
    };
  }

  if (pkg.supportTopUpType !== 2) return { mode: "none" };

  const listed = await fetchEsimAccessTopupPackages(order.esimIccid);
  const packages = listed
    .flatMap((raw) => {
      const offer = packageOffer(raw, meta.usdRubRate);
      return offer ? [offer] : [];
    })
    .sort((a, b) => a.priceUsd - b.priceUsd || a.volumeBytes - b.volumeBytes);

  if (packages.length === 0) return { mode: "none" };
  return { mode: "packages", packages };
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

  if (pkg.supportTopUpType === 3) {
    if (input.days === undefined) return "invalid";
    const amount = quoteDayPassAmount({
      retailPrice: pkg.retailPrice,
      durationDays: pkg.duration,
      extendDays: input.days,
    });
    if (amount === null || !pkg.slug) return "invalid";
    const dataAmountMb = Math.max(0, Math.round(pkg.volume / 1024 ** 2));
    return {
      supplierCost: amount,
      title: pkg.name,
      description: `${pkg.name} · ${input.days}d`,
      priceUsd: retailPriceToUsd(amount),
      priceRub: retailPriceToRub(amount, meta.usdRubRate),
      draft: {
        resellerPlanId: pkg.slug,
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

  const listed = await fetchEsimAccessTopupPackages(order.esimIccid);
  const match = listed.find((raw) => raw.packageCode === input.packageCode);
  const offer = match ? packageOffer(match, meta.usdRubRate) : null;
  if (!match || !offer || typeof match.price !== "number") return "invalid";

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
