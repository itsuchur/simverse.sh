import { describe, expect, test } from "bun:test";

import { ESIMfly, type Package } from "@esimfly/sdk";

import { toRussianNameParts } from "~/server/suppliers/esimfly/localize";
import {
  buildSearchText,
  fetchEsimflyPackages,
  normalizeEsimflyPackages,
  resolveLocation,
  toEsimflyPackage,
} from "~/server/suppliers/esimfly/packages";

const GB = 1024 ** 3;

function loc(locationName: string) {
  return { locationName, locationLogo: "", operatorList: [] };
}

function apiPackage(over: Partial<Package> = {}): Package {
  return {
    package_code: "PHAJHEAYP",
    name: "United States 1GB 7Days",
    region: "United States",
    type: "local",
    data_amount_gb: 1,
    validity_days: 7,
    cost: 1.44,
    currency: "USD",
    features: { voice_minutes: 0, sms_count: 0, is_rechargeable: true },
    is_unlimited: false,
    ...over,
  };
}

describe("resolveLocation", () => {
  test("prefers the supplier countries list", () => {
    const result = resolveLocation(
      apiPackage({
        countries: ["de", "AT", "at", "BE"],
        locationNetworkList: [loc("Atlantis")],
      }),
    );
    expect(result).toEqual({ codes: ["AT", "BE", "DE"], unresolved: [] });
  });

  test("falls back to networks country_iso2", () => {
    const result = resolveLocation(
      apiPackage({
        networks: [
          {
            network_id: 1,
            network_name: "MCI",
            network_type: "4G",
            country_code: "ir",
            country_name: "Iran",
            country_iso2: "ir",
            continent: "Asia",
            mcc_code: "432",
            mnc_code: "11",
          },
        ],
      }),
    );
    expect(result.codes).toEqual(["IR"]);
  });

  test("maps locationNetworkList names to ISO codes", () => {
    const result = resolveLocation(
      apiPackage({
        locationNetworkList: [
          loc("United Kingdom"),
          loc("Spain"),
          loc("Narnia"),
        ],
      }),
    );
    expect(result).toEqual({ codes: ["ES", "GB"], unresolved: ["Narnia"] });
  });

  test("returns nothing when no coverage data is present", () => {
    expect(resolveLocation(apiPackage())).toEqual({
      codes: [],
      unresolved: [],
    });
  });
});

describe("toEsimflyPackage", () => {
  test("normalizes supplier fields into the catalog shape", () => {
    const pkg = toEsimflyPackage(
      apiPackage({
        data_amount_gb: 2.5,
        validity_days: 30,
        provider: "esimfly",
        network_carrier: null,
      }),
      ["US"],
    );
    expect(pkg).toMatchObject({
      packageCode: "PHAJHEAYP",
      name: "United States 1GB 7Days",
      region: "United States",
      type: "local",
      location: "US",
      volume: 2.5 * GB,
      duration: 30,
      durationUnit: "DAY",
      cost: 1.44,
      currency: "USD",
      isUnlimited: false,
      features: { voiceMinutes: 0, smsCount: 0, isRechargeable: true },
      provider: "esimfly",
    });
    expect(pkg.networkCarrier).toBeUndefined();
    expect("priceRub" in pkg).toBe(false);
  });
});

describe("normalizeEsimflyPackages", () => {
  test("keeps resolvable packages and reports skipped ones", () => {
    const { packages, skipped, unresolvedNames } = normalizeEsimflyPackages([
      apiPackage({ package_code: "A", countries: ["US"] }),
      apiPackage({
        package_code: "B",
        locationNetworkList: [loc("Narnia")],
      }),
      apiPackage({
        package_code: "C",
        locationNetworkList: [loc("France"), loc("Mordor")],
      }),
    ]);
    expect(packages.map((pkg) => pkg.packageCode)).toEqual(["A", "C"]);
    expect(packages[1]?.location).toBe("FR");
    expect(skipped.map((pkg) => pkg.package_code)).toEqual(["B"]);
    expect(unresolvedNames).toEqual(["Mordor", "Narnia"]);
  });
});

describe("buildSearchText", () => {
  test("includes country names in both languages for single-country packages", () => {
    const text = buildSearchText(
      toEsimflyPackage(apiPackage({ region: "United States" }), ["US"]),
    );
    expect(text).toContain("United States 1GB 7Days");
    expect(text).toContain("US");
    expect(text).toContain("Соединенные Штаты");
  });

  test("includes the Russian region label for regional packages", () => {
    const pkg = {
      ...toEsimflyPackage(
        apiPackage({ name: "Europe 5GB 30Days", region: "Europe" }),
        ["DE", "FR"],
      ),
      nameRu: "Европа — 5 ГБ, 30 дней",
    };
    const text = buildSearchText(pkg);
    expect(text).toContain("Europe");
    expect(text).toContain("Европа");
    expect(text).toContain("DE FR");
  });
});

describe("toRussianNameParts", () => {
  test("builds parts from structured fields", () => {
    expect(
      toRussianNameParts(
        toEsimflyPackage(
          apiPackage({
            region: "Europe",
            data_amount_gb: 5,
            validity_days: 30,
          }),
          ["DE"],
        ),
      ),
    ).toEqual({
      label: "Europe",
      amount: "5",
      unit: "GB",
      perDay: false,
      days: 30,
      unlimited: false,
    });
  });

  test("uses MB below one gigabyte and flags unlimited plans", () => {
    expect(
      toRussianNameParts(
        toEsimflyPackage(apiPackage({ data_amount_gb: 0.5 }), ["US"]),
      ),
    ).toMatchObject({ amount: "512", unit: "MB" });
    expect(
      toRussianNameParts(
        toEsimflyPackage(apiPackage({ is_unlimited: true }), ["US"]),
      ).unlimited,
    ).toBe(true);
  });
});

describe("fetchEsimflyPackages", () => {
  test("pages through the catalog with limit=100 and signed headers", async () => {
    const requests: URL[] = [];
    const total = 250;
    const fetchImpl = async (input: string, init: RequestInit) => {
      const url = new URL(input);
      requests.push(url);
      const headers = new Headers(init.headers);
      expect(headers.get("RT-AccessCode")).toBe("esf_test");
      expect(headers.get("RT-Signature")).toMatch(/^[0-9A-F]{64}$/);

      const page = Number(url.searchParams.get("page"));
      const limit = Number(url.searchParams.get("limit"));
      const start = (page - 1) * limit;
      const packages = Array.from(
        { length: Math.min(limit, total - start) },
        (_, i) => apiPackage({ package_code: `P${start + i}` }),
      );
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            packages,
            pagination: {
              page,
              limit,
              total,
              total_pages: Math.ceil(total / limit),
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const client = new ESIMfly({
      accessCode: "esf_test",
      secretKey: "sk_test",
      fetch: fetchImpl,
    });
    const packages = await fetchEsimflyPackages(client, { delayMs: 0 });

    expect(packages).toHaveLength(total);
    expect(packages[0]?.package_code).toBe("P0");
    expect(packages.at(-1)?.package_code).toBe("P249");
    expect(requests.map((url) => url.searchParams.get("page"))).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(
      requests.every((url) => url.searchParams.get("limit") === "100"),
    ).toBe(true);
    expect(requests[0]?.pathname).toBe("/api/v1/business/esims/packages");
  });

  test("throws when a page fails so a partial catalog is never written", async () => {
    const client = new ESIMfly({
      accessCode: "esf_test",
      secretKey: "sk_test",
      maxRetries: 0,
      fetch: async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: "Invalid API key",
            code: "INVALID_API_KEY",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
    });
    expect(fetchEsimflyPackages(client, { delayMs: 0 })).rejects.toThrow(
      /Invalid API key/,
    );
  });
});
