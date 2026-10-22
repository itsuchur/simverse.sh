import type { ReactNode } from "react";

import { HomeLocalePicker } from "../../_components/home-locale-picker";
import { MarketingFooter } from "../../_components/marketing-footer";

export function BlogShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background relative flex min-h-dvh flex-col">
      <header className="flex justify-end">
        <HomeLocalePicker />
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 sm:py-24">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
