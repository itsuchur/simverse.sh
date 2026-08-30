import Image from "next/image";

import { strapiMediaSrc } from "~/lib/strapi-media";
import { type StrapiMedia } from "~/server/strapi";

export function ArticleCover({
  cover,
  title,
  priority = false,
}: {
  cover: StrapiMedia | null;
  title: string;
  priority?: boolean;
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
      priority={priority}
      className="h-auto w-full rounded-2xl object-cover"
    />
  );
}
