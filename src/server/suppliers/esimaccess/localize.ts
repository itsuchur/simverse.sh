import "server-only";

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { EsimAccessPackage } from "~/server/suppliers/esimaccess/packages";
import {
  parseName,
  type ParsedName,
} from "~/server/suppliers/esimaccess/parse-package-name";

/**
 * Russian package names, generated once per package and cached in a JSON file
 * that lives in the repo (commit it after syncs produce new entries).
 *
 * - `packages` is keyed by packageCode; `en` is the supplier name at the time
 *   of translation so a supplier rename invalidates the cached translation.
 * - `labels` caches Russian names for region/multi-country labels (the part of
 *   the supplier name before the volume), so OpenRouter is only asked once per
 *   distinct label, not once per package.
 */
type TranslationFile = {
  labels: Record<string, string>;
  packages: Record<string, { en: string; ru: string }>;
};

// Some bundlers pass a URL object for import.meta.url; Node's fileURLToPath
// accepts either, but browser polyfills only accept a string.
const TRANSLATION_FILE_PATH = fileURLToPath(
  new URL("./package-names.ru.json", import.meta.url).href,
);

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemini-2.5-flash";

function readTranslationFile(): TranslationFile {
  try {
    const parsed = JSON.parse(
      readFileSync(TRANSLATION_FILE_PATH, "utf8"),
    ) as Partial<TranslationFile>;
    return { labels: parsed.labels ?? {}, packages: parsed.packages ?? {} };
  } catch (error) {
    console.warn(
      `[localize] could not read ${TRANSLATION_FILE_PATH}, starting empty`,
      error,
    );
    return { labels: {}, packages: {} };
  }
}

function writeTranslationFile(file: TranslationFile) {
  const sorted: TranslationFile = {
    labels: Object.fromEntries(
      Object.entries(file.labels).sort(([a], [b]) => a.localeCompare(b)),
    ),
    packages: Object.fromEntries(
      Object.entries(file.packages).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  try {
    writeFileSync(
      TRANSLATION_FILE_PATH,
      JSON.stringify(sorted, null, 2) + "\n",
    );
  } catch (error) {
    // In production the poller filesystem is ephemeral; a failed write only
    // means the work is redone next sync.
    console.warn(`[localize] could not write ${TRANSLATION_FILE_PATH}`, error);
  }
}

function ruDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} дня`;
  }
  return `${count} дней`;
}

const RU_VOLUME_UNIT: Record<"MB" | "GB", string> = { MB: "МБ", GB: "ГБ" };
const RU_SPEED_UNIT: Record<"K" | "M", string> = {
  K: "Кбит/с",
  M: "Мбит/с",
};

/** Builds the styled Russian name, e.g. «Испания — 3 ГБ, 30 дней». */
function buildRussianName(parsed: ParsedName, labelRu: string): string {
  const amount = parsed.amount.replace(".", ",");
  let tail = `${amount} ${RU_VOLUME_UNIT[parsed.unit]}`;
  if (parsed.perDay) tail += "/день";
  if (parsed.days !== undefined) tail += `, ${ruDays(parsed.days)}`;
  if (parsed.fup) {
    tail += `, далее ${parsed.fup.value} ${RU_SPEED_UNIT[parsed.fup.unit]}`;
  }
  if (parsed.modifier) tail += ` ${parsed.modifier}`;
  return `${labelRu} — ${tail}`;
}

const SINGLE_COUNTRY_CODE = /^[A-Z]{2}$/;

function countryLabelRu(location: string): string | null {
  if (!SINGLE_COUNTRY_CODE.test(location)) return null;
  try {
    const display = new Intl.DisplayNames(["ru"], { type: "region" }).of(
      location,
    );
    // Intl returns the input code itself for codes it has no data for.
    return display && display !== location ? display : null;
  } catch {
    return null;
  }
}

async function translateViaOpenRouter(
  texts: string[],
): Promise<Record<string, string>> {
  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) {
    console.warn(
      "[localize] OPENROUTER_KEY is not set; skipping LLM translation of",
      texts.length,
      "strings",
    );
    return {};
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You translate names of travel eSIM data packages and their region labels " +
            "into natural Russian for a storefront. Reply with a single JSON object " +
            "mapping every input string to its Russian translation, nothing else. " +
            'Keep numbers, "+" signs and parentheses. Translate "areas" as "направлений", ' +
            '"countries" as "страны/стран" with correct declension. Examples: ' +
            '"Europe(30+ areas)" -> "Европа (30+ направлений)", ' +
            '"Japan & South Korea" -> "Япония и Южная Корея", ' +
            '"Gulf Region" -> "Страны Персидского залива".',
        },
        { role: "user", content: JSON.stringify(texts) },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(
      `OpenRouter request failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter response contained no content");
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const text of texts) {
    const value = parsed[text];
    if (typeof value === "string" && value.trim()) {
      result[text] = value.trim();
    }
  }
  return result;
}

/**
 * Returns packages enriched with `nameRu`. Already-translated packages are
 * served from the JSON cache; new ones are generated with Intl plus, for
 * unknown region labels or unparseable names, one OpenRouter call. Failed
 * LLM translations are left out of the cache so they are retried next sync
 * (the package then falls back to its English name in the UI).
 */
export async function withRussianNames(
  packages: EsimAccessPackage[],
): Promise<EsimAccessPackage[]> {
  const file = readTranslationFile();
  let fileChanged = false;

  type Pending = { pkg: EsimAccessPackage; parsed: ParsedName | null };
  const pending: Pending[] = [];

  for (const pkg of packages) {
    if (file.packages[pkg.packageCode]?.en === pkg.name) continue;
    pending.push({ pkg, parsed: parseName(pkg.name) });
  }

  // Strings the built-in path cannot produce: region labels without a single
  // ISO country code, and whole names that did not parse at all.
  const needLlm = new Set<string>();
  for (const { pkg, parsed } of pending) {
    if (!parsed) {
      needLlm.add(pkg.name);
    } else if (
      countryLabelRu(pkg.location) === null &&
      !file.labels[parsed.label]
    ) {
      needLlm.add(parsed.label);
    }
  }

  let llmTranslations: Record<string, string> = {};
  if (needLlm.size > 0) {
    try {
      llmTranslations = await translateViaOpenRouter([...needLlm]);
      console.log(
        `[localize] OpenRouter translated ${Object.keys(llmTranslations).length}/${needLlm.size} strings`,
      );
    } catch (error) {
      console.error("[localize] OpenRouter translation failed", error);
    }
  }

  for (const { pkg, parsed } of pending) {
    let ru: string | undefined;

    if (!parsed) {
      ru = llmTranslations[pkg.name];
    } else {
      let labelRu = countryLabelRu(pkg.location) ?? file.labels[parsed.label];
      if (!labelRu) {
        labelRu = llmTranslations[parsed.label];
        if (labelRu) {
          file.labels[parsed.label] = labelRu;
          fileChanged = true;
        }
      }
      if (labelRu) {
        ru = buildRussianName(parsed, labelRu);
      }
    }

    if (ru) {
      file.packages[pkg.packageCode] = { en: pkg.name, ru };
      fileChanged = true;
    }
  }

  if (fileChanged) {
    writeTranslationFile(file);
  }

  return packages.map((pkg) => ({
    ...pkg,
    nameRu: file.packages[pkg.packageCode]?.ru,
  }));
}
