import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildRussianName,
  withRussianNames,
  type RussianNameParts,
} from "~/server/catalog/localize";

describe("buildRussianName", () => {
  const base: RussianNameParts = {
    label: "Spain",
    amount: "3",
    unit: "GB",
    perDay: false,
    days: 30,
  };

  test("renders volume, per-day and day declensions", () => {
    expect(buildRussianName(base, "Испания")).toBe("Испания — 3 ГБ, 30 дней");
    expect(buildRussianName({ ...base, days: 1 }, "Испания")).toBe(
      "Испания — 3 ГБ, 1 день",
    );
    expect(buildRussianName({ ...base, days: 3 }, "Испания")).toBe(
      "Испания — 3 ГБ, 3 дня",
    );
    expect(
      buildRussianName({ ...base, amount: "1.5", perDay: true }, "Испания"),
    ).toBe("Испания — 1,5 ГБ/день, 30 дней");
  });

  test("renders unlimited plans and FUP", () => {
    expect(buildRussianName({ ...base, unlimited: true }, "Испания")).toBe(
      "Испания — безлимит, 30 дней",
    );
    expect(
      buildRussianName(
        { ...base, fup: { value: 1, unit: "M" }, modifier: "(IIJ)" },
        "Испания",
      ),
    ).toBe("Испания — 3 ГБ, 30 дней, далее 1 Мбит/с (IIJ)");
  });
});

describe("withRussianNames", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
  });

  function tempFile(contents?: string) {
    const dir = mkdtempSync(join(tmpdir(), "localize-"));
    dirs.push(dir);
    const path = join(dir, "names.ru.json");
    if (contents !== undefined) writeFileSync(path, contents);
    return path;
  }

  type Pkg = { packageCode: string; name: string; location: string };
  const parse = (pkg: Pkg): RussianNameParts | null => {
    const match = /^(.+?) (\d+)GB (\d+)Days$/.exec(pkg.name);
    if (!match) return null;
    return {
      label: match[1]!,
      amount: match[2]!,
      unit: "GB",
      perDay: false,
      days: Number(match[3]),
    };
  };

  test("builds names for single countries via Intl and caches them", async () => {
    const translationFile = tempFile();
    const result = await withRussianNames(
      [{ packageCode: "A", name: "Spain 3GB 30Days", location: "ES" }],
      { translationFile, parse },
    );
    expect(result[0]?.nameRu).toBe("Испания — 3 ГБ, 30 дней");

    const cache = JSON.parse(readFileSync(translationFile, "utf8")) as {
      packages: Record<string, { en: string; ru: string }>;
    };
    expect(cache.packages.A).toEqual({
      en: "Spain 3GB 30Days",
      ru: "Испания — 3 ГБ, 30 дней",
    });
  });

  test("uses cached labels for regions and leaves unknown ones untranslated", async () => {
    delete process.env.OPENROUTER_KEY;
    const translationFile = tempFile(
      JSON.stringify({ labels: { Europe: "Европа" }, packages: {} }),
    );
    const result = await withRussianNames(
      [
        { packageCode: "E", name: "Europe 5GB 30Days", location: "DE,FR" },
        { packageCode: "G", name: "Gulf 5GB 30Days", location: "AE,SA" },
      ],
      { translationFile, parse },
    );
    expect(result[0]?.nameRu).toBe("Европа — 5 ГБ, 30 дней");
    expect(result[1]?.nameRu).toBeUndefined();
  });

  test("invalidates cached translations when the supplier renames a package", async () => {
    const translationFile = tempFile(
      JSON.stringify({
        labels: {},
        packages: { A: { en: "Old name", ru: "Старое" } },
      }),
    );
    const result = await withRussianNames(
      [{ packageCode: "A", name: "Spain 1GB 7Days", location: "ES" }],
      { translationFile, parse },
    );
    expect(result[0]?.nameRu).toBe("Испания — 1 ГБ, 7 дней");
  });
});
