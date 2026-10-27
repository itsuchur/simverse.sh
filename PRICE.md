# Prices and absolute margin

Customer prices for eSIM Access come from the supplier's suggested retail, multiplied by `PRICE_MODIFIER`, then rounded up. Wholesale cost is the supplier `price` field and is never multiplied. Absolute margin here is that charge minus wholesale cost. Payment fees, Telegram's cut on Stars, FX spread, and promo discounts are left out.

The worked examples use a modifier of **1.5**, the value currently stored in production Redis. The code reads whatever positive number is in Redis.

`PRICE_MODIFIER` lives in Redis under the key `PRICE_MODIFIER`. The cron seeds it once from the `PRICE_MODIFIER` env var (default 1) and does not overwrite a value the dashboard has saved. Supplier amounts use a scale of 10,000 = $1.

## Two supplier fields

| Field | Meaning |
| --- | --- |
| `price` | What eSIM Access charges us. Stored on the cart as `cost` and on the order as `costAmount`, still in the 10,000 = $1 scale. |
| `retailPrice` | Suggested retail. This is the only amount the modifier scales. |

```text
markedUsd = (retailPrice / 10000) × PRICE_MODIFIER
costUsd   = price / 10000
```

At 1.5, `markedUsd = retailUsd × 1.5`.

## What the customer is charged

Each currency rounds the same marked amount up on its own. The $1 and 1 ₽ floors apply only when the marked amount is below 1.

| Checkout | Charge |
| --- | --- |
| USD (crypto and card) | `max(1, ceil(markedUsd))` whole dollars |
| RUB | `max(1, ceil(markedUsd × USD/RUB))` whole rubles. The rate is the Frankfurter USD/RUB rate saved with that catalog sync. |
| Telegram Stars | `ceil(markedUsd / 0.03)` stars. One star is priced at $0.03. The ceiling uses the exact marked dollars, not the already-ceiled dollar price. |

New-plan prices are written into the Redis catalog by the daily sync. Changing the modifier updates the storefront on the next sync. The dashboard Cost and Retail columns are the raw supplier fields. The RUB and Stars columns are the customer prices after the modifier and the ceiling.

A package whose wholesale `price` is $100 or more is dropped. That cap ignores retail and the modifier.

eSIMfly packages store a supplier cost only. No customer price is derived, and `PRICE_MODIFIER` does not apply.

## Absolute margin

```text
profitUsd = chargedUsd − costUsd
```

In rubles, using the catalog rate and still ignoring FX cost:

```text
profitRub = chargedRub − costUsd × usdRubRate
```

For Stars, valuing each star at the $0.03 used to price it:

```text
profitUsd = chargedStars × 0.03 − costUsd
```

Before the ceiling the dollar profit is `1.5 × retailUsd − costUsd`.

Two percentages, both before expenses:

- **Gross margin** is profit as a share of the charge: `profit / charge`.
- **Markup** is profit as a share of wholesale cost: `profit / cost`.

Before rounding, with modifier 1.5:

```text
gross margin = 1 − price / (1.5 × retailPrice)
markup       = (1.5 × retailPrice / price) − 1
```

These are not one number for the catalog. eSIM Access sets `price` and `retailPrice` independently, so a modifier of 1.5 is 50% on top of their suggested retail, and the resulting margin depends on how far that retail sits above wholesale. The currency ceiling is extra profit: USD rounds up to the next dollar, rubles to the next ruble, Stars to the next $0.03. On a cheap plan the dollar ceiling is the largest of the three, so a USD checkout earns more than Stars for the same package.

A promo multiplies the charge by `(1 − discount%)`. Recompute profit from the discounted charge. The percentages below are list price.

### New plan, Turkey 1GB/day (test fixture)

Wholesale `price` 6,200 ($0.62). Retail 21,700 ($2.17). Marked price $3.255. Before rounding this is exactly 5.25× cost: **gross margin 80.95%**, **markup 425%**.

| Checkout | Charge | Profit | Gross margin | Markup |
| --- | --- | --- | --- | --- |
| USD | $4 | $3.38 | 84.5% | 545.2% |
| Stars | 109 stars ($3.27 at $0.03) | $2.65 | 81.0% | 427.4% |
| RUB at a rate of 90 | 293 ₽ | 237.20 ₽ | 81.0% | 425.1% |

The USD row is higher because $3.255 ceils to $4.

### New plan, Europe 1GB / 7 days (test fixture)

Wholesale 80,000 ($8). Retail 100,000 ($10). Marked price is exactly $15, so the ceiling adds nothing.

Profit is $7. **Gross margin 46.7%** (`7 / 15`). **Markup 87.5%** (`7 / 8`). The structural formula gives the same result: `1 − 80000 / (1.5 × 100000) = 46.7%`.

## Top-ups and day-pass extensions

Data top-ups and day-pass extensions read `PRICE_MODIFIER` from Redis at list time and again at checkout, so a dashboard change applies immediately and does not wait for the catalog sync.

Wholesale is still the unmodified supplier amount:

- Data top-up cost is the top-up package's `price`.
- Day-pass extension cost is `quoteDayPassAmount` on that `price`.

The customer price starts from suggested retail, then the modifier, then the same ceilings as a new plan:

- Data top-up retail is the top-up package's `retailPrice`. If that field is missing or not positive, the wholesale `price` is used as the retail base and then multiplied.
- A day-pass extension first runs `quoteDayPassAmount` on supplier retail (top-up `retailPrice`, or the parent package's `retailPrice` when the top-up omits it). The duration discounts below are applied inside that quote. The modifier multiplies the quoted retail, and only then is the amount ceiled. It is not applied to the cost quote.

Day-pass extension discounts, by length: 4% for 1–4 days, 8% for 5–9, 11% for 10–19, 15% for 20–29, 18% for 30–365. The quote undoes the discount baked into the listed package's own duration, then applies the discount for the extension length. A one-day extension of a one-day plan comes back to that package's raw retail, and the modifier is applied to that result.

Because the day-pass formula scales the retail quote and the cost quote by the same discounts, the pre-ceiling margin stays close to the parent plan's structural margin. Rounding the two quotes separately can move it by a fraction of a percent.

### Day-pass extension, 7 days on the Turkey fixture, modifier 1.5

Retail quote 145,571 ($14.5571), marked to $21.83565, charged as **$22**. Cost quote 41,592 ($4.1592).

Before the dollar ceiling: profit $17.68, **gross margin 80.95%**, **markup 425.0%**. After charging $22: profit $17.84, **gross margin 81.1%**, **markup 429.0%**.

### Data top-up

Same formulas as a new plan, using the top-up package's own `price` and `retailPrice`. A top-up with wholesale $8 and retail $10 at modifier 1.5 charges $15 and has the Europe numbers above: **46.7% gross margin**, **87.5% markup**.

When retail is missing and wholesale is used as the retail base, the pre-ceiling charge is `1.5 × cost`. That is **gross margin 33.3%** (`0.5 / 1.5`) and **markup 50%**.

## Where this is implemented

- Catalog sync applies the modifier in `withPriceRub` (`src/server/suppliers/esimaccess/packages.ts`), called from `src/server/cron/root.ts`.
- `markedRetailPrice` is the shared multiply. An invalid modifier is treated as 1.
- Top-up listing and checkout apply it in `src/server/orders/topup.ts` via `getPriceModifier()`. Supplier cost on the purchase stays the unscaled wholesale quote.
