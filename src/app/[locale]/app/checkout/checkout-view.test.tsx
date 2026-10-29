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

const replace = mock((_href: string) => undefined);
const push = mock((_href: string) => undefined);

void mock.module("~/i18n/navigation", () => ({
  Link: (props: React.ComponentProps<"a">) => <a {...props} />,
  useRouter: () => ({
    push,
    refresh: () => undefined,
    replace,
  }),
  usePathname: () => "/en/app/checkout",
}));
void mock.module("~/lib/use-miniapp-path", () => ({
  useMiniappPath: (path: string) => path,
}));
void mock.module("~/lib/posthog/browser", () => ({
  captureAppEvent: () => undefined,
}));

const { cleanup, fireEvent, render, screen, waitFor } =
  await import("@testing-library/react");
const { NextIntlClientProvider } = await import("next-intl");
const messages = (await import("../../../../../messages/en.json")).default;
const { CheckoutView } = await import("./checkout-view");

afterEach(() => {
  cleanup();
  replace.mockClear();
  push.mockClear();
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

function renderCheckout(
  initialPayment: { orderUuid: string; invoiceUrl: string } | null = null,
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CheckoutView
        initialPayment={initialPayment}
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
  test(`PayPal button is ${locale === "en" ? "visible" : "hidden"} on the ${locale} checkout`, async () => {
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
    const button = screen.queryByRole("button", { name: "Pay with PayPal" });
    if (locale === "en") {
      expect(button).toBeTruthy();
      expect(button?.querySelector("img")?.getAttribute("src")).toBe(
        "/paypal.svg",
      );
    } else {
      expect(button).toBeNull();
    }
  });
}

const invoice = {
  orderUuid: "6f1b5c3a-1d2e-4f5a-8b7c-9d0e1f2a3b4c",
  invoiceUrl: "https://www.paypal.com/checkoutnow?token=existing",
};

test("opening payment replaces the method buttons; continuing reuses its invoice", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const open = mock(() => null);
  const originalOpen = window.open.bind(window);
  window.open = open;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    calls.push(path);
    return Response.json(
      path.startsWith("/api/checkout/status")
        ? { paymentStatus: "pending" }
        : invoice,
    );
  }) as typeof fetch;
  try {
    renderCheckout();
    fireEvent.click(screen.getByRole("button", { name: "Pay with PayPal" }));
    expect(screen.getByText("Creating your payment link?")).toBeTruthy();
    await screen.findByText("Waiting for payment");
    expect(
      screen.queryByRole("button", { name: "Pay with PayPal" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Cryptocurrency/ })).toBeNull();
    expect(screen.queryByText("I have a promo code")).toBeNull();
    expect(
      screen.getByRole("link", { name: "My eSIMs" }).getAttribute("href"),
    ).toBe("/myesim");
    expect(
      screen
        .getByRole("button", { name: "Back to App" })
        .hasAttribute("disabled"),
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Continue payment" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue payment" }));
    expect(open).toHaveBeenCalledTimes(3);
    expect(
      calls.filter((path) => path === "/api/checkout/paypal"),
    ).toHaveLength(1);
    expect(replace).not.toHaveBeenCalled();
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    window.open = originalOpen;
  }
});

test("a restored invoice remains usable when payment status is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url,
    );
    return Response.json({ error: "unavailable" }, { status: 503 });
  }) as typeof fetch;
  try {
    renderCheckout(invoice);
    expect(screen.getByText("Waiting for payment")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Continue payment" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Pay with PayPal" }),
    ).toBeNull();
    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]).toContain("/api/checkout/status?");
    expect(replace).not.toHaveBeenCalled();
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
  }
});

test("only server-confirmed payment shows preparation and redirects to My eSIMs", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL) =>
    Response.json({ paymentStatus: "paid" })) as typeof fetch;
  try {
    renderCheckout(invoice);
    await screen.findByText("Payment received. Preparing your eSIM?");
    expect(
      screen.queryByRole("button", { name: "Continue payment" }),
    ).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/myesim"), {
      timeout: 2500,
    });
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
  }
});
