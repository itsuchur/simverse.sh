import { expect, test } from "bun:test";
import { displayedCountries } from "./displayed-countries";

test("omits RU and UA from regional display, normalizes and deduplicates codes", () => {
  const packages = [{ location: "RU,UA,DE" }, { location: " ua, de, FR, " }];
  expect(displayedCountries(packages)).toEqual(["DE", "FR"]);
  expect(packages[0]?.location).toBe("RU,UA,DE");
});

test("keeps single-country presentation separate from regional omissions", () => {
  expect(displayedCountries([{ location: "RU" }])).toEqual(["RU"]);
  expect(displayedCountries([{ location: "FR" }])).toEqual(["FR"]);
  expect(displayedCountries([{ location: "" }])).toEqual([]);
});
