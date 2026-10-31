import { describe, expect, test } from "bun:test";

import {
  articleAlternates,
  canonicalRequestTarget,
  pageAlternates,
  isBlogArticlePath,
} from "./public-url";

describe("canonical public URLs", () => {
  test("sends www to the apex and drops the trailing slash in one hop", () => {
    expect(canonicalRequestTarget("www.simverse.sh", "/ru/tos/")).toEqual({
      host: "simverse.sh",
      pathname: "/ru/tos",
    });
  });

  for (const [oldPath, newPath] of [
    ["/", "/blog"],
    ["/how-to-install-an-e-sim", "/blog/how-to-install-an-e-sim"],
    ["/ru/", "/ru/blog"],
    ["/ru/kak-ustanovit-e-sim/", "/ru/blog/kak-ustanovit-e-sim"],
    ["/en/how-to-install-an-e-sim/", "/blog/how-to-install-an-e-sim"],
    ["/ru/blog/kak-ustanovit-e-sim/", "/ru/blog/kak-ustanovit-e-sim"],
    ["/blog", "/blog"],
    ["/blogosphere", "/blog/blogosphere"],
  ] as const) {
    test(`moves the old blog path ${oldPath} to ${newPath}`, () => {
      expect(canonicalRequestTarget("blog.simverse.sh", oldPath)).toEqual({
        host: "simverse.sh",
        pathname: newPath,
      });
    });
  }

  test("leaves canonical marketing, blog, and mini app paths alone", () => {
    for (const path of [
      "/ru",
      "/blog",
      "/ru/blog",
      "/blog/how-to-install-an-e-sim",
    ] as const) {
      expect(canonicalRequestTarget("simverse.sh", path)).toBeNull();
    }
    expect(
      canonicalRequestTarget("miniapp.simverse.sh", "/ru/profile"),
    ).toBeNull();
  });

  test("drops a trailing slash without changing host", () => {
    expect(
      canonicalRequestTarget("miniapp.simverse.sh", "/ru/profile/"),
    ).toEqual({
      host: "miniapp.simverse.sh",
      pathname: "/ru/profile",
    });
  });
});

describe("hreflang", () => {
  test("only blog articles suppress inherited path-based language alternates", () => {
    expect(isBlogArticlePath("simverse.sh", "/blog/article")).toBe(true);
    expect(isBlogArticlePath("simverse.sh", "/ru/blog/article")).toBe(true);
    expect(isBlogArticlePath("simverse.sh", "/blog")).toBe(false);
    expect(isBlogArticlePath("simverse.sh", "/ru/blog")).toBe(false);
    expect(isBlogArticlePath("miniapp.simverse.sh", "/blog/article")).toBe(
      false,
    );
  });

  test("pairs marketing pages that share a path", () => {
    expect(pageAlternates("https://simverse.sh", "/ru/tos")).toEqual({
      canonical: "https://simverse.sh/ru/tos",
      languages: {
        en: "https://simverse.sh/tos",
        ru: "https://simverse.sh/ru/tos",
        "x-default": "https://simverse.sh/tos",
      },
    });
  });

  test("pairs article translations by slug and skips a missing language", () => {
    expect(
      articleAlternates("https://simverse.sh", "en", {
        en: "how-to-install-an-e-sim",
        ru: "kak-ustanovit-e-sim",
      }),
    ).toEqual({
      canonical: "https://simverse.sh/blog/how-to-install-an-e-sim",
      languages: {
        en: "https://simverse.sh/blog/how-to-install-an-e-sim",
        ru: "https://simverse.sh/ru/blog/kak-ustanovit-e-sim",
        "x-default": "https://simverse.sh/blog/how-to-install-an-e-sim",
      },
    });

    expect(
      articleAlternates("https://simverse.sh", "ru", {
        ru: "tolko-po-russki",
      }).languages,
    ).toEqual({
      ru: "https://simverse.sh/ru/blog/tolko-po-russki",
    });
  });
});
