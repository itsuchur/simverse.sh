"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  excludePackageCode,
  restorePackageCode,
} from "~/server/catalog/package-exclusions";
import { requireDashboardSession } from "~/server/dashboard/access";

import { PACKAGE_PROVIDERS } from "./provider-tabs";

const providerSchema = z.enum(PACKAGE_PROVIDERS);
const packageCodeSchema = z.string().trim().min(1).max(255);

export async function excludePackageCodeAction(
  provider: string,
  packageCode: string,
) {
  await requireDashboardSession();
  await excludePackageCode(
    providerSchema.parse(provider),
    packageCodeSchema.parse(packageCode),
  );
  revalidatePath("/dashboard/packages");
}

export async function restorePackageCodeAction(
  provider: string,
  packageCode: string,
) {
  await requireDashboardSession();
  await restorePackageCode(
    providerSchema.parse(provider),
    packageCodeSchema.parse(packageCode),
  );
  revalidatePath("/dashboard/packages");
}
