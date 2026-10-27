"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parsePromoCode } from "~/lib/promo-code";
import { requireDashboardSession } from "~/server/dashboard/access";
import { db, isUniqueConstraintError } from "~/server/db";

const createSchema = z.object({
  code: z.string(),
  discountPercent: z.number().int().min(1).max(99),
  oncePerUser: z.boolean(),
  maxRedemptions: z.number().int().positive().nullable(),
  startsAt: z.string().min(1),
  endsAt: z.string().nullable(),
  note: z.string().max(500).nullable(),
});

function parseInstant(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function createPromoCodeAction(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireDashboardSession();
  const parsed = createSchema.parse(input);
  const code = parsePromoCode(parsed.code);
  if (!code) throw new Error("Use 4–32 letters or numbers only.");
  const startsAt = parseInstant(parsed.startsAt);
  if (!startsAt) throw new Error("Enter a start date.");
  const endsAt = parsed.endsAt ? parseInstant(parsed.endsAt) : null;
  if (parsed.endsAt && !endsAt) throw new Error("Enter an end date.");
  if (endsAt && endsAt <= startsAt) {
    throw new Error("The end date must be after the start date.");
  }
  const note = parsed.note?.trim() ? parsed.note.trim() : null;
  try {
    await db.promoCode.create({
      data: {
        code,
        discountPercent: parsed.discountPercent,
        maxPerUser: parsed.oncePerUser ? 1 : null,
        maxRedemptions: parsed.maxRedemptions,
        startsAt,
        endsAt,
        note,
        createdById: session.user.id,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("That promo code already exists.");
    }
    throw error;
  }
  revalidatePath("/dashboard/promos");
}

export async function revokePromoCodeAction(id: string, reason: string) {
  const session = await requireDashboardSession();
  const trimmed = reason.trim();
  if (!trimmed || trimmed.length > 500) {
    throw new Error("Enter a reason.");
  }
  const updated = await db.promoCode.updateMany({
    where: { id: BigInt(id), revokedAt: null },
    data: {
      revokedAt: new Date(),
      revokedById: session.user.id,
      revokeReason: trimmed,
    },
  });
  if (!updated.count) throw new Error("This promo code is already revoked.");
  revalidatePath("/dashboard/promos");
}
