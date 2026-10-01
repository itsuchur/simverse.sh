"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  excludeCountryCode,
  excludePackageCode,
  restoreCountryCode,
  restorePackageCode,
} from "~/server/catalog/package-exclusions";
import { requireDashboardSession } from "~/server/dashboard/access";
import { ESIMACCESS_SUPPLIER } from "~/server/suppliers/esimaccess/packages";

const packageCodeSchema = z.string().trim().min(1).max(255);
const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/);

export async function excludePackageCodeAction(packageCode: string) {
  await requireDashboardSession();
  const parsed = packageCodeSchema.parse(packageCode);
  await excludePackageCode(ESIMACCESS_SUPPLIER, parsed);
  revalidatePath("/dashboard/packages");
}

export async function restorePackageCodeAction(packageCode: string) {
  await requireDashboardSession();
  const parsed = packageCodeSchema.parse(packageCode);
  await restorePackageCode(ESIMACCESS_SUPPLIER, parsed);
  revalidatePath("/dashboard/packages");
}

export async function excludeCountryCodeAction(countryCode: string) {
  await requireDashboardSession();
  const parsed = countryCodeSchema.parse(countryCode);
  await excludeCountryCode(ESIMACCESS_SUPPLIER, parsed);
  revalidatePath("/dashboard/packages");
}

export async function restoreCountryCodeAction(countryCode: string) {
  await requireDashboardSession();
  const parsed = countryCodeSchema.parse(countryCode);
  await restoreCountryCode(ESIMACCESS_SUPPLIER, parsed);
  revalidatePath("/dashboard/packages");
}
