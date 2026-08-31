import "server-only";

import { headers } from "next/headers";

import {
  isPrettyMiniappHost,
  miniappPath,
  type MiniappPage,
} from "~/lib/miniapp-path";

export async function miniappPathForRequest(
  page: MiniappPage,
): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  return miniappPath(page, isPrettyMiniappHost(host));
}
