import { describe, expect, test } from "bun:test";

import { articleTags } from "./article-tags";

describe("articleTags", () => {
  test("reads the TagsInput save payload and decoded Strapi JSON", () => {
    const tags = [{ name: "Travel" }, { name: "eSIM" }];
    expect(articleTags(JSON.stringify(tags))).toEqual(["Travel", "eSIM"]);
    expect(articleTags(tags)).toEqual(["Travel", "eSIM"]);
  });

  test("handles missing tags and malformed content without breaking a page", () => {
    for (const value of [null, undefined, "", "invalid JSON", {}, "null"]) {
      expect(articleTags(value)).toEqual([]);
    }
    expect(
      articleTags([
        null,
        {},
        { name: 12 },
        " ",
        " Travel ",
        { name: "Travel" },
      ]),
    ).toEqual(["Travel"]);
  });
});
