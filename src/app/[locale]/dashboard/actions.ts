"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireDashboardSession } from "~/server/dashboard/access";
import { setPriceModifier } from "~/server/price-modifier";
import { setSalesActive } from "~/server/sales";
import { setPopularCountryCodes } from "~/server/suppliers/esimaccess/packages";

const popularCountriesSchema = z
  .array(z.string().length(2))
  .max(50);

const priceModifierSchema = z.number().positive().finite();

export async function setSalesActiveAction(active: boolean) {
  await requireDashboardSession();
  await setSalesActive(active);
  revalidatePath("/dashboard");
}

export async function setPriceModifierAction(value: number) {
  await requireDashboardSession();
  await setPriceModifier(priceModifierSchema.parse(value));
  revalidatePath("/dashboard");
}

export async function setPopularCountriesAction(countryCodes: string[]) {
  await requireDashboardSession();
  const parsed = popularCountriesSchema.parse(countryCodes);
  await setPopularCountryCodes(parsed);
  revalidatePath("/dashboard");
}
