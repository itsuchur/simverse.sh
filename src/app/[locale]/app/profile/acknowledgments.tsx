"use client";

import { ChevronRight, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Card, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { openExternalLink } from "~/lib/telegram-webapp";

const OPEN_SOURCE = [
  {
    name: "Next.js",
    license: "MIT",
    href: "https://github.com/vercel/next.js",
  },
  { name: "React", license: "MIT", href: "https://github.com/facebook/react" },
  {
    name: "next-intl",
    license: "MIT",
    href: "https://github.com/amannn/next-intl",
  },
  {
    name: "Prisma",
    license: "Apache-2.0",
    href: "https://github.com/prisma/prisma",
  },
  { name: "tRPC", license: "MIT", href: "https://github.com/trpc/trpc" },
  {
    name: "TanStack Query",
    license: "MIT",
    href: "https://github.com/TanStack/query",
  },
  { name: "Zod", license: "MIT", href: "https://github.com/colinhacks/zod" },
  {
    name: "better-auth",
    license: "MIT",
    href: "https://github.com/better-auth/better-auth",
  },
  {
    name: "Base UI",
    license: "MIT",
    href: "https://github.com/mui/base-ui",
  },
  { name: "shadcn/ui", license: "MIT", href: "https://ui.shadcn.com" },
  {
    name: "Lucide",
    license: "ISC",
    href: "https://github.com/lucide-icons/lucide",
  },
  {
    name: "Tailwind CSS",
    license: "MIT",
    href: "https://github.com/tailwindlabs/tailwindcss",
  },
  {
    name: "class-variance-authority",
    license: "Apache-2.0",
    href: "https://github.com/joe-bell/cva",
  },
  {
    name: "FingerprintJS",
    license: "MIT",
    href: "https://github.com/fingerprintjs/fingerprintjs",
  },
  {
    name: "PostHog",
    license: "MIT",
    href: "https://github.com/PostHog/posthog-js",
  },
  {
    name: "Sentry SDK",
    license: "MIT",
    href: "https://github.com/getsentry/sentry-javascript",
  },
  {
    name: "node-redis",
    license: "MIT",
    href: "https://github.com/redis/node-redis",
  },
  { name: "Croner", license: "MIT", href: "https://github.com/hexagon/croner" },
  {
    name: "SuperJSON",
    license: "MIT",
    href: "https://github.com/blitz-js/superjson",
  },
  {
    name: "react-country-flag",
    license: "MIT",
    href: "https://github.com/danalloway/react-country-flag",
  },
] as const;

const GEIST_OFL_URL = "https://scripts.sil.org/OFL";

function ExternalTextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="text-foreground underline-offset-3 hover:underline"
      onClick={(event) => {
        event.preventDefault();
        openExternalLink(href);
      }}
    >
      {children}
    </a>
  );
}

export function Acknowledgments() {
  const t = useTranslations("Profile");

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Card
            size="sm"
            className="hover:bg-muted/40 w-full cursor-pointer transition-colors"
          />
        }
      >
        <div className="flex items-center gap-3 px-(--card-spacing)">
          <span className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
            <Heart className="size-4" aria-hidden />
          </span>
          <CardTitle className="min-w-0 flex-1">
            {t("acknowledgments")}
          </CardTitle>
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        </div>
      </DialogTrigger>
      <DialogContent className="data-open:zoom-in-100 data-closed:zoom-out-100 bg-background inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none">
        <DialogHeader className="shrink-0 px-14 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
          <DialogTitle className="text-center text-xl leading-snug">
            {t("acknowledgments")}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto flex max-w-lg flex-col gap-6">
            <DialogDescription className="text-lg">
              {t("acknowledgmentsIntro")}
            </DialogDescription>
            <section className="space-y-2">
              <h3 className="text-muted-foreground text-base font-medium">
                {t("acknowledgmentsOpenSource")}
              </h3>
              <ul className="divide-border divide-y">
                {OPEN_SOURCE.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className="flex items-baseline justify-between gap-3 py-2.5 text-lg"
                      onClick={(event) => {
                        event.preventDefault();
                        openExternalLink(item.href);
                      }}
                    >
                      <span className="min-w-0 font-medium">{item.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {item.license}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-muted-foreground text-base font-medium">
                {t("acknowledgmentsFonts")}
              </h3>
              <p className="text-lg leading-relaxed">
                {t.rich("acknowledgmentsGeist", {
                  ofl: (chunks) => (
                    <ExternalTextLink href={GEIST_OFL_URL}>
                      {chunks}
                    </ExternalTextLink>
                  ),
                })}
              </p>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
