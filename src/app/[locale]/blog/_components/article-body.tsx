"use client";

import {
  BlocksRenderer,
  type BlocksContent,
} from "@strapi/blocks-react-renderer";

import { strapiMediaSrc } from "~/lib/strapi-media";

export function ArticleBody({ content }: { content: unknown }) {
  if (!Array.isArray(content) || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 text-base leading-7 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal">
      <BlocksRenderer
        content={content as BlocksContent}
        blocks={{
          image: ({ image }) => {
            const src = strapiMediaSrc(image.url);
            if (!src) {
              return null;
            }
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={image.alternativeText ?? ""}
                width={image.width}
                height={image.height}
                className="h-auto w-full rounded-xl"
              />
            );
          },
        }}
      />
    </div>
  );
}
