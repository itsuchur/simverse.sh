import { describe, expect, test } from "bun:test";

import { requestLocale } from "~/server/email/request-locale";

describe("requestLocale", () => {
  test("the calling page's locale prefix wins", () => {
    expect(
      requestLocale(
        new Headers({
          referer: "https://simverse.sh/ru/checkout?package=X",
          cookie: "NEXT_LOCALE=en",
        }),
      ),
    ).toBe("ru");
    expect(
      requestLocale(
        new Headers({
          referer: "https://simverse.sh/checkout",
          "accept-language": "ru-RU",
        }),
      ),
    ).toBe("en");
  });

  test("without a referer, the locale cookie then Accept-Language decide", () => {
    expect(requestLocale(new Headers({ cookie: "a=1; NEXT_LOCALE=ru" }))).toBe(
      "ru",
    );
    expect(
      requestLocale(new Headers({ "accept-language": "ru,en;q=0.8" })),
    ).toBe("ru");
    expect(requestLocale(new Headers())).toBe("en");
    expect(requestLocale(undefined)).toBe("en");
  });
});
