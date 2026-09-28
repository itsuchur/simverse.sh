import { describe, expect, test } from "bun:test";

import {
  groupRegionalPackages,
  type RegionalPackageSource,
} from "~/server/suppliers/esimaccess/regional-groups";

function pkg(
  overrides: Partial<RegionalPackageSource> &
    Pick<RegionalPackageSource, "packageCode" | "name" | "location">,
): RegionalPackageSource {
  return {
    volume: 5_000_000_000,
    duration: 30,
    retailPrice: 50_000,
    ...overrides,
  };
}

function labels(packages: RegionalPackageSource[]) {
  return groupRegionalPackages(packages).map((group) => group.regionLabel);
}

describe("groupRegionalPackages", () => {
  test("merges Europe coverage suffixes into one row", () => {
    const groups = groupRegionalPackages([
      pkg({
        packageCode: "EU35",
        name: "Europe (35 areas) 10GB 30Days",
        nameRu: "Европа (35 направлений) — 10 ГБ, 30 дней",
        location: "FR,DE",
        volume: 10,
      }),
      pkg({
        packageCode: "EU31",
        name: "Europe (31 areas) 5GB 30Days",
        nameRu: "Европа (31 направление) — 5 ГБ, 30 дней",
        location: "FR",
        volume: 5,
      }),
      pkg({
        packageCode: "EU",
        name: "Europe 3GB 30Days",
        nameRu: "Европа — 3 ГБ, 30 дней",
        location: "FR,DE,IT",
        volume: 3,
      }),
      pkg({
        packageCode: "EU30",
        name: "Europe(30+ areas) 1GB 7Days",
        nameRu: "Европа (30+ направлений) — 1 ГБ, 7 дней",
        location: "FR",
        volume: 1,
        duration: 7,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.regionLabel).toBe("Europe");
    expect(groups[0]?.regionLabelRu).toBe("Европа");
    expect(groups[0]?.packages.map((item) => item.packageCode).sort()).toEqual([
      "EU",
      "EU30",
      "EU31",
      "EU35",
    ]);
  });

  test("merges South America and keeps a distinct Morocco bundle", () => {
    expect(
      labels([
        pkg({
          packageCode: "SA",
          name: "South America 5GB 30Days",
          nameRu: "Южная Америка — 5 ГБ, 30 дней",
          location: "BR,AR",
        }),
        pkg({
          packageCode: "SA6",
          name: "South America (6 areas) 10GB 30Days",
          nameRu: "Южная Америка (6 направлений) — 10 ГБ, 30 дней",
          location: "BR,AR,CL",
          volume: 10,
        }),
        pkg({
          packageCode: "EUM",
          name: "Europe (40+ areas) & Morocco 10GB 30Days",
          nameRu: "Европа (40+ направлений) и Марокко — 10 ГБ, 30 дней",
          location: "FR,MA",
        }),
        pkg({
          packageCode: "CN",
          name: "China (mainland & HK) 3GB 30Days",
          location: "CN,HK",
          volume: 3,
        }),
      ]),
    ).toEqual([
      "China (mainland & HK)",
      "Europe (40+ areas) & Morocco",
      "South America",
    ]);
  });

  test("drops Asia-20 and AUKUS", () => {
    expect(
      labels([
        pkg({
          packageCode: "A20",
          name: "Asia-20 1GB 30 Days",
          location: "JP,KR",
          volume: 1,
        }),
        pkg({
          packageCode: "AUK",
          name: "AUKUS(3 countries) 1GB 30days",
          nameRu: "AUKUS (3 страны) — 1 ГБ, 30 дней",
          location: "AU,US,GB",
          volume: 1,
        }),
        pkg({
          packageCode: "AS",
          name: "Asia (12 areas) 3GB 30Days",
          nameRu: "Азия (12 направлений) — 3 ГБ, 30 дней",
          location: "JP,KR,TH",
          volume: 3,
        }),
      ]),
    ).toEqual(["Asia"]);
  });

  test("renames GCC onto Gulf Region", () => {
    const groups = groupRegionalPackages([
      pkg({
        packageCode: "GCC3",
        name: "GCC 3GB 30Days",
        nameRu: "ССАГПЗ — 3 ГБ, 30 дней",
        location: "AE,SA",
        volume: 3,
      }),
      pkg({
        packageCode: "GULF5",
        name: "Gulf Region 5GB 30Days",
        nameRu: "Страны Персидского залива — 5 ГБ, 30 дней",
        location: "AE,SA,QA",
        volume: 5,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.regionLabel).toBe("Gulf Region");
    expect(groups[0]?.regionLabelRu).toBe("Страны Персидского залива");
    expect(groups[0]?.packages.map((item) => item.packageCode).sort()).toEqual([
      "GCC3",
      "GULF5",
    ]);
  });

  test("keeps the wider plan when the same size exists twice", () => {
    const groups = groupRegionalPackages([
      pkg({
        packageCode: "NARROW",
        name: "Europe 5GB 30Days",
        location: "FR,DE",
        retailPrice: 10_000,
      }),
      pkg({
        packageCode: "WIDE",
        name: "Europe (35 areas) 5GB 30Days",
        location: "FR,DE,IT,ES,PT",
        retailPrice: 20_000,
      }),
    ]);

    expect(groups[0]?.packages.map((item) => item.packageCode)).toEqual([
      "WIDE",
    ]);
  });

  test("keeps the cheaper plan when coverage ties", () => {
    const groups = groupRegionalPackages([
      pkg({
        packageCode: "PRICEY",
        name: "Europe 5GB 30Days",
        location: "FR,DE",
        retailPrice: 30_000,
      }),
      pkg({
        packageCode: "CHEAP",
        name: "Europe (31 areas) 5GB 30Days",
        location: "IT,ES",
        retailPrice: 10_000,
      }),
    ]);

    expect(groups[0]?.packages.map((item) => item.packageCode)).toEqual([
      "CHEAP",
    ]);
  });

  test("keeps daily and throttled plans beside a total-data plan", () => {
    const groups = groupRegionalPackages([
      pkg({
        packageCode: "TOTAL",
        name: "Europe 3GB 30Days",
        location: "FR,DE",
        volume: 3,
      }),
      pkg({
        packageCode: "DAILY",
        name: "Europe 3GB/Day 30Days",
        location: "FR",
        volume: 3,
      }),
      pkg({
        packageCode: "FUP",
        name: "Europe 3GB 30Days FUP1Mbps",
        location: "FR",
        volume: 3,
      }),
    ]);

    expect(groups[0]?.packages.map((item) => item.packageCode).sort()).toEqual([
      "DAILY",
      "FUP",
      "TOTAL",
    ]);
  });
});
