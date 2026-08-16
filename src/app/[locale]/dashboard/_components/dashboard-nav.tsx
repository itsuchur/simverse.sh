"use client";

import { Button } from "~/components/ui/button";
import { Link, usePathname, useRouter } from "~/i18n/navigation";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/utils";

const navItems = [
  {
    href: "/dashboard",
    label: "Home",
    match: (path: string) => path === "/dashboard",
  },
  {
    href: "/dashboard/orders",
    label: "Orders",
    match: (path: string) => path.startsWith("/dashboard/orders"),
  },
  {
    href: "/dashboard/users",
    label: "Users",
    match: (path: string) => path.startsWith("/dashboard/users"),
  },
  {
    href: "/dashboard/webhooks",
    label: "Webhooks",
    match: (path: string) => path.startsWith("/dashboard/webhooks"),
  },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="border-border border-b">
      <div className="flex items-center justify-between gap-6 px-8 py-4">
        <nav className="flex items-center gap-1" aria-label="Dashboard">
          {navItems.map(({ href, label, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-4 py-2 text-base font-medium",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-10 px-4 text-base"
          onClick={() => {
            void authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  router.replace("/dashboard");
                  router.refresh();
                },
              },
            });
          }}
        >
          Sign out
        </Button>
      </div>
    </header>
  );
}
