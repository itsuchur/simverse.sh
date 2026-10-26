import { expect, test } from "bun:test";
import { extractCoverage } from "./coverage";

test("keeps countries separate and merges carrier capabilities", () => {
  expect(
    extractCoverage(
      [
        {
          locationName: "France",
          operatorList: [
            { operatorName: " Orange ", networkType: "4G/5G" },
            { operatorName: "Orange", networkType: "LTE/4G" },
          ],
        },
        {
          locationName: "Spain",
          operatorList: [{ operatorName: "Orange", networkType: "3G/4G" }],
        },
      ],
      "FR,ES",
    ),
  ).toEqual([
    {
      countryCode: "FR",
      operators: [
        { operatorName: "Orange", networkTypes: ["4G", "5G", "LTE"] },
      ],
    },
    {
      countryCode: "ES",
      operators: [{ operatorName: "Orange", networkTypes: ["3G", "4G"] }],
    },
  ]);
});

test("does not assign unresolved regional carriers to a guessed country", () => {
  expect(
    extractCoverage(
      [
        {
          locationName: "Unknown",
          operatorList: [{ operatorName: "Carrier", networkType: "5G" }],
        },
      ],
      "FR,ES",
    ),
  ).toEqual([]);
});

test("handles missing and malformed data without inventing network types", () => {
  expect(extractCoverage(undefined, "FR")).toEqual([]);
  expect(
    extractCoverage(
      [
        null,
        1,
        {
          operatorList: [null, {}, { operatorName: "Carrier", networkType: 5 }],
        },
      ],
      "FR",
    ),
  ).toEqual([
    {
      countryCode: "FR",
      operators: [{ operatorName: "Carrier", networkTypes: [] }],
    },
  ]);
});
