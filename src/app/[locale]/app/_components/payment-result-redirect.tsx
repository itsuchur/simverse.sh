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
}: {
  src: string;
  page: MiniappPage;
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
    <main className="flex flex-1 items-center justify-center py-12">
      <DotLottieReact src={src} loop autoplay className="size-64" />
    </main>
  );
}
