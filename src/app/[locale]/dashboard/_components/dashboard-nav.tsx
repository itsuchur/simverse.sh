"use client";

import { useState } from "react";
import { MenuIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
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
    href: "/dashboard/packages",
    label: "Packages",
    match: (path: string) => path.startsWith("/dashboard/packages"),
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

function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={cn("h-10 px-4 text-base", className)}
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
  );
}

function NavLinks({
  onNavigate,
  className,
  linkClassName,
}: {
  onNavigate?: () => void;
  className?: string;
  linkClassName?: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className={className}>
      {navItems.map(({ href, label, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "rounded-lg px-4 py-2 text-base font-medium",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              linkClassName,
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:gap-6 md:px-8 md:py-4">
        <div className="hidden md:contents">
          <NavLinks className="flex items-center gap-1" />
          <SignOutButton />
        </div>

        <div className="flex w-full items-center justify-between md:hidden">
          <p className="text-base font-semibold tracking-tight">Dashboard</p>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => {
              setOpen(true);
            }}
          >
            <MenuIcon />
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="right" className="w-[min(100%,20rem)] p-0">
              <SheetHeader className="border-border border-b">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <NavLinks
                className="flex flex-col gap-1 p-4"
                linkClassName="w-full"
                onNavigate={() => {
                  setOpen(false);
                }}
              />
              <div className="border-border mt-auto border-t p-4">
                <SignOutButton className="w-full" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
