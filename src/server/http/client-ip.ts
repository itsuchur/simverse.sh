import "server-only";

import { isIP } from "node:net";

function parseIp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  let candidate = value.trim();
  if (candidate.startsWith("[") && candidate.endsWith("]")) {
    candidate = candidate.slice(1, -1);
  }
  return isIP(candidate) ? candidate : null;
}

/**
 * Visitor IP behind Cloudflare (and Traefik). Prefers CF-Connecting-IP so we
 * do not store an edge or proxy address when those headers are present.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const cfConnecting = parseIp(headers.get("cf-connecting-ip"));
  if (cfConnecting) {
    return cfConnecting;
  }
  const trueClient = parseIp(headers.get("true-client-ip"));
  if (trueClient) {
    return trueClient;
  }
  const realIp = parseIp(headers.get("x-real-ip"));
  if (realIp) {
    return realIp;
  }
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) {
    return null;
  }
  for (const hop of forwarded.split(",")) {
    const ip = parseIp(hop);
    if (ip) {
      return ip;
    }
  }
  return null;
}
