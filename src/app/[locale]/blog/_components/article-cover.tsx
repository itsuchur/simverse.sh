import Image from "next/image";

import { strapiMediaSrc } from "~/lib/strapi-media";
import { type StrapiMedia } from "~/server/strapi";

export function ArticleCover({
  cover,
  title,
  preload = false,
  thumbnail = false,
}: {
  cover: StrapiMedia | null;
  title: string;
  preload?: boolean;
  thumbnail?: boolean;
}) {
  const src = strapiMediaSrc(cover?.url);
  if (!src) {
    return null;
  }

  const width = cover?.width && cover.width > 0 ? cover.width : 1200;
  const height = cover?.height && cover.height > 0 ? cover.height : 630;

  return (
    <Image
      src={src}
      alt={cover?.alternativeText ?? title}
      width={width}
      height={height}
      preload={preload}
      sizes={
        thumbnail
          ? "(max-width: 640px) calc(100vw - 48px), 320px"
          : "(max-width: 720px) calc(100vw - 48px), 672px"
      }
      className={
        thumbnail
          ? "aspect-video w-full max-w-xs rounded-2xl object-cover"
          : "h-auto w-full rounded-2xl object-cover"
      }
    />
  );
}
