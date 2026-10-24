import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ArticleBody } from "./article-body";

test("renders existing article text and Better Blocks formatting", () => {
  const html = renderToStaticMarkup(
    <ArticleBody
      content={[
        {
          type: "paragraph",
          children: [{ type: "text", text: "Existing body", bold: true }],
        },
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "Colored text",
              color: "#ff0000",
              backgroundColor: "#ffff00",
            },
          ],
        },
        {
          type: "table",
          children: [
            {
              type: "table-row",
              children: [
                {
                  type: "table-cell",
                  children: [{ type: "text", text: "Table cell" }],
                },
              ],
            },
          ],
        },
        {
          type: "image",
          image: {
            url: "/uploads/article.png",
            alternativeText: "Article image",
          },
          caption: "Image caption",
          imageAlign: "right",
          children: [{ type: "text", text: "" }],
        },
      ]}
    />,
  );

  expect(html).toContain("<strong>Existing body</strong>");
  expect(html).toContain("color:#ff0000");
  expect(html).toContain("background-color:#ffff00");
  expect(html).toContain("<table");
  expect(html).toContain("Table cell");
  expect(html).toContain('src="/cms-media/uploads/article.png"');
  expect(html).toContain("text-align:right");
  expect(html).toContain("<figcaption>Image caption</figcaption>");
});

test("omits empty or invalid article bodies", () => {
  for (const content of [null, undefined, {}, []]) {
    expect(renderToStaticMarkup(<ArticleBody content={content} />)).toBe("");
  }
});
