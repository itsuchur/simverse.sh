import type { ReactNode } from "react";

import { Link } from "~/i18n/navigation";

import { HomeLocalePicker } from "../../_components/home-locale-picker";
import { MarketingFooter } from "../../_components/marketing-footer";

export function BlogShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background relative flex min-h-dvh flex-col">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="mt-4 ml-6 text-sm font-semibold tracking-tight underline-offset-4 hover:underline"
        >
          Simverse
        </Link>
        <HomeLocalePicker />
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 sm:py-24">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
