"use client";

import { ChevronRight, Heart } from "lucide-react";
import { useTranslations } from "next-intl";

import { LegalLink } from "../../_components/legal-link";
import { OverlayBackToAppButton } from "./overlay-back-to-app";
import { Card, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

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

const documentTitleClassName =
  "w-full max-w-4xl text-center text-5xl leading-tight font-extrabold tracking-tight text-balance sm:text-6xl md:text-7xl";

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
      <DialogContent
        showCloseButton={false}
        className="data-open:zoom-in-100 data-closed:zoom-out-100 bg-background inset-0 top-0 left-0 flex h-[var(--tg-viewport-stable-height,100dvh)] max-h-[var(--tg-viewport-stable-height,100dvh)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none"
      >
        <OverlayBackToAppButton />
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-6 pt-[max(6rem,calc(var(--tg-safe-area-inset-top,env(safe-area-inset-top,0px))+var(--tg-content-safe-area-inset-top,0px)+3.5rem))] pb-[max(1.5rem,calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom,0px))+var(--tg-content-safe-area-inset-bottom,0px)))] [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto flex w-full flex-col items-center">
            <DialogHeader className="w-full">
              <DialogTitle className={documentTitleClassName}>
                {t("acknowledgments")}
              </DialogTitle>
            </DialogHeader>
            <article className="text-muted-foreground mt-12 w-full max-w-2xl space-y-4 text-sm leading-6 wrap-break-word sm:mt-16">
              <DialogDescription>{t("acknowledgmentsIntro")}</DialogDescription>
              <h2 className="text-foreground mt-10 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {t("acknowledgmentsOpenSource")}
              </h2>
              <ul className="list-disc space-y-1 pl-5">
                {OPEN_SOURCE.map((item) => (
                  <li key={item.name}>
                    <LegalLink href={item.href}>{item.name}</LegalLink> (
                    {item.license})
                  </li>
                ))}
              </ul>
              <h2 className="text-foreground mt-10 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {t("acknowledgmentsFonts")}
              </h2>
              <p>
                {t.rich("acknowledgmentsGeist", {
                  ofl: (chunks) => (
                    <LegalLink href={GEIST_OFL_URL}>{chunks}</LegalLink>
                  ),
                })}
              </p>
            </article>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
