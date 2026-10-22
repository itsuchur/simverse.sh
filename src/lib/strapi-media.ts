/** Same-origin media path served by the runtime Strapi media route. */
export function strapiMediaSrc(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  let path: string;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const parsed = new URL(url);
    path = `${parsed.pathname}${parsed.search}`;
  } else {
    path = url.startsWith("/") ? url : `/${url}`;
  }

  return `/cms-media${path}`;
}
