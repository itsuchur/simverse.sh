import "server-only";

import { fileURLToPath } from "node:url";

import { withRussianNames as localize } from "~/server/catalog/localize";
import type { EsimAccessPackage } from "~/server/suppliers/esimaccess/packages";
import { parseName } from "~/server/suppliers/esimaccess/parse-package-name";

// Some bundlers pass a URL object for import.meta.url; Node's fileURLToPath
// accepts either, but browser polyfills only accept a string.
const TRANSLATION_FILE_PATH = fileURLToPath(
  new URL("./package-names.ru.json", import.meta.url).href,
);

/** eSIM Access names are parsed from the supplier string, e.g. "Spain 3GB 30Days". */
export function withRussianNames(
  packages: EsimAccessPackage[],
): Promise<EsimAccessPackage[]> {
  return localize(packages, {
    translationFile: TRANSLATION_FILE_PATH,
    parse: (pkg) => parseName(pkg.name),
  });
}
