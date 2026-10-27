import { db } from "~/server/db";

import { PromoManager, type PromoRow } from "./promo-manager";

export const dynamic = "force-dynamic";

function promoStatus(promo: {
  revokedAt: Date | null;
  startsAt: Date;
  endsAt: Date | null;
}): PromoRow["status"] {
  const now = new Date();
  if (promo.revokedAt) return "Revoked";
  if (promo.startsAt > now) return "Scheduled";
  if (promo.endsAt && promo.endsAt <= now) return "Expired";
  return "Active";
}

export default async function DashboardPromosPage() {
  const promos = await db.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          redemptions: { where: { releasedAt: null } },
        },
      },
    },
  });

  const rows: PromoRow[] = promos.map((promo) => ({
    id: promo.id.toString(),
    code: promo.code,
    discountPercent: promo.discountPercent,
    oncePerUser: promo.maxPerUser === 1,
    maxRedemptions: promo.maxRedemptions,
    liveRedemptions: promo._count.redemptions,
    startsAt: promo.startsAt.toISOString(),
    endsAt: promo.endsAt?.toISOString() ?? null,
    note: promo.note,
    status: promoStatus(promo),
    revokeReason: promo.revokeReason,
  }));

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Promos</h1>
      <PromoManager promos={rows} />
    </main>
  );
}
