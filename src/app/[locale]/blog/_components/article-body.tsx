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
    <div className="[&_blockquote]:text-muted-foreground space-y-6 text-base leading-7 [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_h2]:pt-4 [&_h2]:text-3xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h3]:pt-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:tracking-tight [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal">
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
