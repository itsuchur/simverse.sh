import { env } from "~/env";

/** Docker `next build` skips env validation; these URLs are unset until runtime. */
function origin(url: string | undefined) {
  return url?.replace(/\/$/, "");
}

export function dashboardOrigin() {
  return origin(env.BETTER_AUTH_URL);
}

export function miniappOrigin() {
  return origin(env.MINIAPP_URL ?? env.BETTER_AUTH_URL);
}

export function apiOrigin() {
  return origin(env.API_URL ?? env.BETTER_AUTH_URL);
}

/** Public webhook/API path. Dedicated `API_URL` host omits `/api`; local/ngrok keeps it. */
export function apiPublicUrl(pathname: string) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (env.API_URL) {
    return `${apiOrigin()}${path}`;
  }
  return `${apiOrigin()}/api${path}`;
}
