"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CardSim, Home, User } from "lucide-react";

import { cn } from "~/lib/utils";

const items = [
  {
    href: "/app",
    label: "Home",
    icon: Home,
    match: (path: string) => path === "/app",
  },
  {
    href: "/app/myesim",
    label: "My eSIMs",
    icon: CardSim,
    match: (path: string) => path.startsWith("/app/myesim"),
  },
  {
    href: "/app/profile",
    label: "Profile",
    icon: User,
    match: (path: string) => path.startsWith("/app/profile"),
  },
] as const;

export function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/80"
    >
      <div className="mx-auto grid max-w-lg grid-cols-3 gap-1 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
