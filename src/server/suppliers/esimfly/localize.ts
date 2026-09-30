import "server-only";

import { fileURLToPath } from "node:url";

import {
  withRussianNames as localize,
  type RussianNameParts,
} from "~/server/catalog/localize";
import type { EsimflyPackage } from "~/server/suppliers/esimfly/packages";

const TRANSLATION_FILE_PATH = fileURLToPath(
  new URL("./package-names.ru.json", import.meta.url).href,
);

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function formatAmount(value: number) {
  return String(Math.round(value * 100) / 100);
}

/**
 * eSIMfly packages carry structured volume/validity fields, so the Russian
 * name is built from those and only the region label may need translating.
 */
export function toRussianNameParts(pkg: EsimflyPackage): RussianNameParts {
  const gb = pkg.volume / GB;
  const useGb = gb >= 1;
  return {
    label: pkg.region,
    amount: useGb ? formatAmount(gb) : formatAmount(pkg.volume / MB),
    unit: useGb ? "GB" : "MB",
    perDay: false,
    days: pkg.duration,
    unlimited: pkg.isUnlimited,
  };
}

export function withRussianNames(
  packages: EsimflyPackage[],
): Promise<EsimflyPackage[]> {
  return localize(packages, {
    translationFile: TRANSLATION_FILE_PATH,
    parse: toRussianNameParts,
  });
}
