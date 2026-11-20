"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "~/components/ui/button";
import { Link, useRouter } from "~/i18n/navigation";

/** Puts the package chosen on the website into the signed-in buyer's cart. */
export function CartLoader({ packageCode }: { packageCode: string }) {
  const t = useTranslations("Store");
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void fetch("/api/cart", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageCode }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`cart ${response.status}`);
        router.replace("/checkout");
        router.refresh();
      })
      .catch((error: unknown) => {
        console.error("[checkout] cart update failed", error);
        setFailed(true);
      });
  }, [packageCode, router]);

  if (failed) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
        <p className="text-base leading-7">{t("cartFailed")}</p>
        <Link
          href="/esim"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          {t("allDestinations")}
        </Link>
      </main>
    );
  }

  return (
    <main className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 py-24">
      <LoaderCircle className="size-6 animate-spin" aria-hidden />
      <p className="text-sm">{t("preparingCart")}</p>
    </main>
  );
}
