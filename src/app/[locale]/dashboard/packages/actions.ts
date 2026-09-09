"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  excludePackageCode,
  restorePackageCode,
} from "~/server/catalog/package-exclusions";
import { requireDashboardSession } from "~/server/dashboard/access";
import { ESIMACCESS_SUPPLIER } from "~/server/suppliers/esimaccess/packages";

const packageCodeSchema = z.string().trim().min(1).max(255);

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
