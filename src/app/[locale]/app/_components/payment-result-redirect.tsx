"use client";

import { useEffect } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

import { useRouter } from "~/i18n/navigation";
import type { MiniappPage } from "~/lib/miniapp-path";
import { useMiniappPath } from "~/lib/use-miniapp-path";

const REDIRECT_MS = 2500;

export function PaymentResultRedirect({
  src,
  page,
  title,
  description,
}: {
  src: string;
  page: MiniappPage;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const href = useMiniappPath(page);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      router.replace(href);
    }, REDIRECT_MS);
    return () => window.clearTimeout(timeout);
  }, [href, router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <DotLottieReact src={src} loop autoplay className="size-64" />
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-lg font-medium">{title}</p>
        <p className="text-muted-foreground text-base leading-7">{description}</p>
      </div>
    </main>
  );
}
