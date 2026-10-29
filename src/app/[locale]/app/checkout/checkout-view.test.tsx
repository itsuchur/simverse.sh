import type { AbstractIntlMessages } from "next-intl";
import { afterEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/en/app/checkout" });
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "Node",
  "MutationObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: key === "window" ? window : window[key as "document"],
  });
}

void mock.module("~/i18n/navigation", () => ({
  useRouter: () => ({
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
  }),
  usePathname: () => "/en/app/checkout",
}));
void mock.module("~/lib/use-miniapp-path", () => ({
  useMiniappPath: () => "/",
}));
void mock.module("~/lib/posthog/browser", () => ({
  captureAppEvent: () => undefined,
}));

const { cleanup, fireEvent, render, screen } =
  await import("@testing-library/react");
const { NextIntlClientProvider } = await import("next-intl");
const messages = (await import("../../../../../messages/en.json")).default;
const { CheckoutView } = await import("./checkout-view");

afterEach(() => {
  cleanup();
});

const plan = {
  supplier: "esimaccess" as const,
  packageCode: "PKG",
  slug: "pkg",
  country: "US",
  data_gb: 1,
  validity_days: 7,
  price: 100,
  price_rub: 1000,
  price_stars: 50,
  cost: 10,
  currency: "USD" as const,
  qty: 1 as const,
  networks: [],
  name: "United States 1GB",
  isUnlimited: false,
};

function renderCheckout() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CheckoutView
        plan={plan}
        cartRevision="6f1b5c3a-1d2e-4f5a-8b7c-9d0e1f2a3b4c"
        supportTopUpType={1}
        networkCoverage={[]}
      />
    </NextIntlClientProvider>,
  );
}

test("a promo code is applied only after the server accepts it", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url,
    );
    return Response.json({
      discountPercent: 10,
      priceRub: 900,
      priceUsd: 90,
    });
  }) as typeof fetch;

  try {
    renderCheckout();
    expect(screen.queryByLabelText("Promo code")).toBeNull();
    const toggle = document.querySelector('input[type="checkbox"]');
    if (!toggle) throw new Error("promo checkbox missing");
    fireEvent.click(toggle);
    const input = screen.getByLabelText("Promo code");

    fireEvent.change(input, { target: { value: "WELCOME-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText("Use 4–32 letters or numbers only.")).toBeTruthy();
    expect(calls).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: /Cryptocurrency/ }).textContent,
    ).toContain("$100");

    fireEvent.change(input, { target: { value: "welcome10" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText("10% off");
    expect(calls).toEqual(["/api/checkout/promo"]);
    expect(
      screen.getByRole("button", { name: /Cryptocurrency/ }).textContent,
    ).toContain("$90");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

for (const locale of ["en", "ru"] as const) {
  test(`PayPal button is present on the ${locale} checkout`, async () => {
    const localeMessages: AbstractIntlMessages =
      locale === "en"
        ? messages
        : (await import("../../../../../messages/ru.json")).default;
    render(
      <NextIntlClientProvider locale={locale} messages={localeMessages}>
        <CheckoutView
          plan={plan}
          cartRevision={crypto.randomUUID()}
          supportTopUpType={1}
          networkCoverage={[]}
        />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Pay with PayPal" }),
    ).toBeTruthy();
  });
}
