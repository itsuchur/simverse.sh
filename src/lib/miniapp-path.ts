export type MiniappPage =
  | "/"
  | "/checkout"
  | "/myesim"
  | "/profile"
  | "/successful-payment"
  | "/failed-payment";

const PRETTY_MINIAPP_HOSTS = new Set(["miniapp.simverse.sh"]);

function hostnameOf(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeHost(host: string | null | undefined): string {
  return host?.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
}

export function isPrettyMiniappHost(host: string | null | undefined): boolean {
  const hostname = normalizeHost(host);
  if (!hostname) {
    return false;
  }
  if (PRETTY_MINIAPP_HOSTS.has(hostname)) {
    return true;
  }
  const miniapp = hostnameOf(process.env.MINIAPP_URL);
  const dashboard = hostnameOf(process.env.BETTER_AUTH_URL);
  if (!miniapp || miniapp === dashboard) {
    return false;
  }
  return miniapp === hostname;
}

/** Public Mini App path. Dedicated miniapp host omits `/app`; local/ngrok keeps it. */
export function miniappPath(page: MiniappPage, pretty: boolean): string {
  if (pretty) {
    return page;
  }
  return page === "/" ? "/app" : `/app${page}`;
}

export function miniappPublicUrl(origin: string, page: MiniappPage): string {
  let host: string | null = null;
  try {
    host = new URL(origin).hostname;
  } catch {
    host = null;
  }
  return `${origin.replace(/\/$/, "")}${miniappPath(page, isPrettyMiniappHost(host))}`;
}

export function pathnameHasAppPrefix(pathname: string): boolean {
  return pathname === "/app" || pathname.startsWith("/app/");
}

export function isMiniappCheckoutPath(pathname: string): boolean {
  return (
    pathname === "/checkout" ||
    pathname.startsWith("/checkout/") ||
    pathname === "/app/checkout" ||
    pathname.startsWith("/app/checkout/")
  );
}

export function isMiniappHomePath(pathname: string): boolean {
  return pathname === "/" || pathname === "/app";
}

export function isMiniappSectionPath(
  pathname: string,
  section: "myesim" | "profile",
): boolean {
  return (
    pathname === `/${section}` ||
    pathname.startsWith(`/${section}/`) ||
    pathname === `/app/${section}` ||
    pathname.startsWith(`/app/${section}/`)
  );
}
