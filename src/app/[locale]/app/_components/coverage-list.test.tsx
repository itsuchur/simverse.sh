import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en.json";
import type { CatalogPackage } from "~/server/suppliers/esimaccess/catalog-types";
import { CoverageList } from "./coverage-list";

test("renders carriers with supplied connection icons and missing-data fallback", () => {
  const pkg: CatalogPackage = {
    packageCode: "test",
    slug: "test",
    name: "Europe",
    isUnlimited: false,
    volume: 1,
    duration: 7,
    durationUnit: "DAY",
    currencyCode: "USD",
    location: "FR,ES",
    coverage: [
      {
        countryCode: "FR",
        operators: [{ operatorName: "Orange", networkTypes: ["4G", "5G"] }],
      },
    ],
  };
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CoverageList packages={[pkg]} locale="en" />
    </NextIntlClientProvider>,
  );
  expect(html).toContain("France");
  expect(html).toContain("Spain");
  expect(html).toContain("Orange");
  expect(html).toContain("/4G.svg");
  expect(html).toContain("/5G.svg");
  expect(html).toContain('aria-label="5G"');
  expect(html).toContain("Network details unavailable");
  expect(html).not.toContain("/3G.svg");
});
