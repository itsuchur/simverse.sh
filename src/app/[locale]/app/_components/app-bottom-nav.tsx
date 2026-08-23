"use client";

import { CardSim, Home, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

export function AppBottomNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const items = [
    {
      href: "/app",
      label: t("home"),
      icon: Home,
      match: (path: string) => path === "/app",
    },
    {
      href: "/app/myesim",
      label: t("myEsims"),
      icon: CardSim,
      match: (path: string) => path.startsWith("/app/myesim"),
    },
    {
      href: "/app/profile",
      label: t("profile"),
      icon: User,
      match: (path: string) => path.startsWith("/app/profile"),
    },
  ] as const;

  return (
    <nav
      aria-label={t("ariaLabel")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
    >
      <div className="pointer-events-auto mx-auto w-full max-w-lg px-4 pb-[max(0.75rem,calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom,0px))+var(--tg-content-safe-area-inset-bottom,0px)))]">
        <div className="border-border/70 flex items-center gap-1 rounded-full border bg-white/90 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur-xl supports-backdrop-filter:bg-white/75">
          {items.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
