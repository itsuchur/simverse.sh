import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { HomeLocalePicker } from "./home-locale-picker";
import { buttonVariants } from "~/components/ui/button";
import { getPathname } from "~/i18n/navigation";
import { marketingUrl } from "~/lib/marketing-url";
import { cn } from "~/lib/utils";

const SOCIAL_LINKS = [
  { name: "Telegram", src: "/telegram.svg", href: "https://t.me/simverseteam" },
  {
    name: "Instagram",
    src: "/instagram.svg",
    href: "https://instagram.com/simverseteam",
  },
  { name: "X", src: "/x.svg", href: "https://x.com/simverseteam" },
] as const;

export async function MarketingHeader() {
  const t = await getTranslations("Blog");
  const locale = await getLocale();

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 px-3 pt-4 sm:gap-2 sm:px-6 lg:px-10 lg:pt-6">
      <nav aria-label="Social media" className="flex gap-1 sm:gap-2 lg:gap-3">
        {SOCIAL_LINKS.map((social) => (
          <a
            key={social.name}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.name}
            className={cn(
              buttonVariants({ size: "icon", variant: "ghost" }),
              "size-8 sm:size-9 lg:size-12",
            )}
          >
            <Image
              src={social.src}
              alt=""
              width={20}
              height={20}
              className="size-5 lg:size-7 dark:invert"
            />
          </a>
        ))}
      </nav>
      <a
        href={marketingUrl(getPathname({ href: "/", locale }))}
        className="focus-visible:outline-ring block w-18 rounded-sm outline-offset-4 focus-visible:outline-2 min-[400px]:w-28 sm:w-40 lg:w-64"
      >
        <Image
          src="/logo-sim-pari.svg"
          alt="Simverse"
          width={368}
          height={192}
          className="h-auto w-full dark:invert"
        />
      </a>
      <div className="flex items-center gap-1 justify-self-end sm:gap-2 lg:gap-3">
        <a
          href={marketingUrl(getPathname({ href: "/blog", locale }))}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 px-2 sm:px-3 lg:h-12 lg:px-4 lg:text-lg",
          )}
        >
          {t("title")}
        </a>
        <HomeLocalePicker />
      </div>
    </header>
  );
}
