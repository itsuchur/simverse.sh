# Restore Telegram Stars on checkout

Telegram Stars is hidden from the miniapp checkout screen. The payment path still works. Restore only the checkout button. Do not change the invoice API, pricing, fulfillment, or copy.

## What is already in place

Leave these files as they are:

- `src/app/api/checkout/stars/route.ts` creates a Stars invoice and returns `{ invoiceUrl }`.
- `src/lib/telegram-webapp.ts` exports `openTelegramInvoice(url)`, which resolves to `"paid"`, `"pending"`, `"failed"`, or `"cancelled"`.
- Cart plans still include `price_stars`. `checkout_started` in the checkout view still sends `priceStars`.
- `Checkout.payStars` already exists in `messages/en.json` and `messages/ru.json`: `"Telegram Stars · {price}"`.
- Profile transaction history still shows past Stars amounts via `starsAmount`.

## Only file to edit

`src/app/[locale]/app/checkout/checkout-view.tsx`

1. Add `Astroid` back to the `lucide-react` import, next to `Bitcoin`.
2. Import `openTelegramInvoice` from `~/lib/telegram-webapp`.
3. After `const homeHref = useMiniappPath("/");`, add:

```tsx
const myEsimHref = useMiniappPath("/myesim");
```

4. After the `cardPrice` block, add:

```tsx
const starsPrice = format.number(plan.price_stars);
```

5. In the payment column (`<div className="mt-auto flex flex-col gap-3">`), insert this button before the card button. It is the primary button: no `variant`. Card and crypto stay `variant="outline"`.

```tsx
<Button
  type="button"
  size="lg"
  className="h-12 w-full text-lg"
  disabled={leaving || paying}
  onClick={() => {
    setPaying(true);
    setPayError(null);
    captureAppEvent("checkout_method_selected", {
      method: "stars",
      packageCode: plan.packageCode,
    });
    void requestInvoice("/api/checkout/stars", cartRevision, locale)
      .then((url) => {
        captureAppEvent("checkout_invoice_opened", {
          method: "stars",
          packageCode: plan.packageCode,
        });
        return openTelegramInvoice(url);
      })
      .then((status) => {
        if (status === "paid" || status === "pending") {
          router.push(myEsimHref);
          return;
        }
        if (status === "failed") {
          captureAppEvent("checkout_invoice_failed", {
            method: "stars",
            packageCode: plan.packageCode,
          });
          setPayError(t("payFailed"));
        }
      })
      .catch((error: unknown) => {
        console.error("[checkout] stars invoice", error);
        captureAppEvent("checkout_invoice_failed", {
          method: "stars",
          packageCode: plan.packageCode,
        });
        setPayError(
          error instanceof Error && error.message === "cart_changed"
            ? t("cartChanged")
            : t("payFailed"),
        );
        if (error instanceof Error && error.message === "cart_changed")
          router.refresh();
      })
      .finally(() => {
        setPaying(false);
      });
  }}
>
  <Astroid data-icon="inline-start" className="size-6" />
  {t("payStars", { price: starsPrice })}
</Button>
```

`requestInvoice` is already defined in this file. Reuse it. A `"cancelled"` invoice status should clear the paying state and show no error, which the handler above already does.

After the button is back, delete this file.
