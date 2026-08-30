import type { ReactNode } from "react";

import { Link } from "~/i18n/navigation";

export function BlogShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-border border-b px-6 py-4">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Simverse
          </Link>
          <Link
            href="/blog"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            {title}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-14">
        {children}
      </main>
    </div>
  );
}
