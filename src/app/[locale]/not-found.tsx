import { getTranslations } from "next-intl/server";

import { buttonVariants } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

import { MarketingFooter } from "./_components/marketing-footer";
import { MarketingHeader } from "./_components/marketing-header";

export default async function MarketingNotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="bg-background relative flex min-h-dvh flex-col">
      <MarketingHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center sm:py-24">
        <p
          aria-hidden="true"
          className="text-muted-foreground/30 text-[9rem] leading-none font-extrabold tracking-tighter select-none sm:text-[12rem] md:text-[15rem]"
        >
          404
        </p>
        <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-5xl md:text-6xl">
          <span className="sr-only">404: </span>
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-6 max-w-md text-base leading-7 text-pretty">
          {t("description")}
        </p>
        <div className="mt-10 flex w-full max-w-sm flex-col items-stretch justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row">
          <Link
            href="/"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 px-8 text-base font-semibold",
            )}
          >
            {t("home")}
          </Link>
          <a
            href="https://t.me/simversebot"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "h-12 px-8 text-base font-semibold",
            )}
          >
            {t("cta")}
          </a>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
