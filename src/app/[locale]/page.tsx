import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { FAQ_KEYS } from "./_components/faq-keys";
import { MarketingHeader } from "./_components/marketing-header";
import { MarketingFooter } from "./_components/marketing-footer";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const PAYMENT_METHODS = [
  // Square files pad the wordmark, so a taller box matches the other marks.
  {
    src: "/MIR.svg",
    altKey: "paymentMirAlt",
    width: 512,
    height: 512,
    className: "h-[8.2rem]",
  },
  {
    src: "/VISA.svg",
    altKey: "paymentVisaAlt",
    width: 512,
    height: 512,
    className: "h-[7rem]",
  },
  {
    src: "/MC.svg",
    altKey: "paymentMcAlt",
    width: 116,
    height: 91,
    className: "h-12",
  },
  {
    src: "/SBP.svg",
    altKey: "paymentSbpAlt",
    width: 239,
    height: 120,
    className: "h-12",
  },
] as const;

export default async function Home() {
  const t = await getTranslations("HomePage");
  const help = await getTranslations("Help");
  const locale = await getLocale();

  return (
    <div className="bg-background relative flex min-h-dvh flex-col">
      <MarketingHeader />
      <main className="flex flex-1 flex-col items-center px-6 py-16 text-center sm:py-24">
        <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight text-balance sm:text-6xl md:text-7xl">
          {t("headline")}
        </h1>
        <a
          href="https://t.me/simversebot"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-10 h-12 px-8 text-base font-semibold",
          )}
        >
          {t("cta")}
        </a>
        <Image
          src={locale === "ru" ? "/miniappRU.png" : "/miniappEN.png"}
          alt={t("screenshotAlt")}
          width={390}
          height={800}
          preload
          unoptimized
          className="mt-12 h-auto w-full max-w-sm drop-shadow-lg"
        />
        <section className="mt-16 w-full max-w-2xl text-left sm:mt-20">
          <h2 className="mb-8 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("faqHeading")}
          </h2>
          <div className="space-y-6">
            {FAQ_KEYS.map((key) => (
              <details key={key}>
                <summary className="cursor-pointer list-none text-lg font-bold tracking-tight [&::-webkit-details-marker]:hidden">
                  {help(`${key}Title`)}
                </summary>
                <p className="text-muted-foreground mt-3 text-sm leading-6">
                  {help.rich(key, {
                    code: (chunks) => (
                      <code className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-[0.8125rem]">
                        {chunks}
                      </code>
                    ),
                  })}
                </p>
              </details>
            ))}
          </div>
        </section>
        {locale === "ru" ? (
          <section className="mt-16 w-full max-w-2xl sm:mt-20">
            <ul className="flex flex-wrap items-center justify-center gap-6">
              {PAYMENT_METHODS.map((method) => (
                <li key={method.src}>
                  <Image
                    src={method.src}
                    alt={t(method.altKey)}
                    width={method.width}
                    height={method.height}
                    unoptimized
                    className={cn(
                      method.className,
                      "w-auto shrink-0 object-contain",
                    )}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <MarketingFooter />
    </div>
  );
}
