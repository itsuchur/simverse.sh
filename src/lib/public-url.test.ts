import { describe, expect, test } from "bun:test";

import {
  articleAlternates,
  canonicalRequestTarget,
  pageAlternates,
  prettyBlogPath,
} from "./public-url";

describe("canonical public URLs", () => {
  test("sends www to the apex and drops the trailing slash in one hop", () => {
    expect(canonicalRequestTarget("www.simverse.sh", "/ru/tos/")).toEqual({
      host: "simverse.sh",
      pathname: "/ru/tos",
    });
  });

  test("sends apex blog paths to the blog host", () => {
    expect(
      canonicalRequestTarget("simverse.sh", "/blog/how-to-install-an-e-sim"),
    ).toEqual({
      host: "blog.simverse.sh",
      pathname: "/how-to-install-an-e-sim",
    });
    expect(canonicalRequestTarget("simverse.sh", "/ru/blog/")).toEqual({
      host: "blog.simverse.sh",
      pathname: "/ru",
    });
    expect(
      canonicalRequestTarget(
        "simverse.sh",
        "/en/blog/how-to-install-an-e-sim/",
      ),
    ).toEqual({
      host: "blog.simverse.sh",
      pathname: "/how-to-install-an-e-sim",
    });
  });

  test("pretty-roots a blog-host path that still contains /blog", () => {
    expect(
      canonicalRequestTarget(
        "blog.simverse.sh",
        "/ru/blog/kak-ustanovit-e-sim/",
      ),
    ).toEqual({
      host: "blog.simverse.sh",
      pathname: "/ru/kak-ustanovit-e-sim",
    });
  });

  test("leaves canonical marketing, blog, and mini app paths alone", () => {
    expect(canonicalRequestTarget("simverse.sh", "/ru")).toBeNull();
    expect(
      canonicalRequestTarget("blog.simverse.sh", "/how-to-install-an-e-sim"),
    ).toBeNull();
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

  test("does not treat a similarly prefixed path as the blog", () => {
    expect(prettyBlogPath("/blogosphere")).toBeNull();
  });
});

describe("hreflang", () => {
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
      articleAlternates("https://blog.simverse.sh", "en", {
        en: "how-to-install-an-e-sim",
        ru: "kak-ustanovit-e-sim",
      }),
    ).toEqual({
      canonical: "https://blog.simverse.sh/how-to-install-an-e-sim",
      languages: {
        en: "https://blog.simverse.sh/how-to-install-an-e-sim",
        ru: "https://blog.simverse.sh/ru/kak-ustanovit-e-sim",
        "x-default": "https://blog.simverse.sh/how-to-install-an-e-sim",
      },
    });

    expect(
      articleAlternates("https://blog.simverse.sh", "ru", {
        ru: "tolko-po-russki",
      }).languages,
    ).toEqual({
      ru: "https://blog.simverse.sh/ru/tolko-po-russki",
    });
  });
});
