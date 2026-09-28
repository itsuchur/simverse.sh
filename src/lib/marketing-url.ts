const MARKETING_ORIGIN = "https://simverse.sh";

/** Absolute marketing-site URL for a locale path such as `/tos` or `/ru/tos`. */
export function marketingUrl(pathname: string) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${MARKETING_ORIGIN}${path}`;
}
