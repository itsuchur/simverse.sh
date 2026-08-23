"use client";

import { usePathname } from "~/i18n/navigation";
import {
  isPrettyMiniappHost,
  miniappPath,
  pathnameHasAppPrefix,
  type MiniappPage,
} from "~/lib/miniapp-path";

export function useMiniappPath(page: MiniappPage): string {
  const pathname = usePathname();
  const pretty =
    typeof window !== "undefined"
      ? isPrettyMiniappHost(window.location.hostname)
      : !pathnameHasAppPrefix(pathname);
  return miniappPath(page, pretty);
}
