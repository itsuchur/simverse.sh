import { describe, expect, test } from "bun:test";

import { countryCodeForSlug, countrySlug } from "./country-slug";

describe("countrySlug", () => {
  test("uses the lowercase English country name", () => {
    expect(countrySlug("TR")).toBe("turkiye");
    expect(countrySlug("US")).toBe("united-states");
    expect(countrySlug("GB")).toBe("united-kingdom");
  });

  test("strips accents and punctuation", () => {
    const slug = countrySlug("CI");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug).not.toMatch(/^-|-$/);
  });

  test("resolves a slug back to a listed country only", () => {
    expect(countryCodeForSlug("united-states", ["DE", "US"])).toBe("US");
    expect(countryCodeForSlug("united-states", ["DE"])).toBeUndefined();
  });
});
