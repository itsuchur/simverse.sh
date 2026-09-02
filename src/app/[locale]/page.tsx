import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { FAQ_KEYS } from "./_components/faq-keys";
import { HomeLocalePicker } from "./_components/home-locale-picker";
import { buttonVariants } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

const PAYMENT_METHODS = [
  { src: "/MIR.svg", altKey: "paymentMirAlt" },
  { src: "/VISA.svg", altKey: "paymentVisaAlt" },
  { src: "/MC.svg", altKey: "paymentMcAlt" },
  { src: "/SBP.svg", altKey: "paymentSbpAlt" },
] as const;

export default async function Home() {
  const t = await getTranslations("HomePage");
  const help = await getTranslations("Help");
  const tos = await getTranslations("Tos");
  const privacy = await getTranslations("PrivacyPolicy");
  const locale = await getLocale();

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <HomeLocalePicker />
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
          src="/miniapp.png"
          alt={t("screenshotAlt")}
          width={390}
          height={800}
          priority
          unoptimized
          className="mt-12 h-auto w-full max-w-sm drop-shadow-lg"
        />
        <section className="mt-16 w-full max-w-2xl text-left sm:mt-20">
          <h2 className="mb-8 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("faqHeading")}
          </h2>
          <div className="space-y-4">
            {FAQ_KEYS.map((key) => (
              <details
                key={key}
                className="border-border bg-card rounded-xl border px-5 py-4 shadow-sm"
              >
                <summary className="cursor-pointer text-lg font-bold tracking-tight">
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
            <h2 className="mb-8 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t("paymentMethodsHeading")}
            </h2>
            <ul className="flex flex-wrap items-center justify-center gap-6">
              {PAYMENT_METHODS.map((method) => (
                <li key={method.src}>
                  <Image
                    src={method.src}
                    alt={t(method.altKey)}
                    width={512}
                    height={512}
                    unoptimized
                    className="h-12 w-auto object-contain"
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <footer className="border-border text-muted-foreground border-t px-6 py-8 text-center text-sm">
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link
            href="/tos"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            {tos("title")}
          </Link>
          <Link
            href="/privacy-policy"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            {privacy("title")}
          </Link>
        </nav>
      </footer>
    </div>
  );
}
