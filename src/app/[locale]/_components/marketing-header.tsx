import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { HomeLocalePicker } from "./home-locale-picker";
import { buttonVariants } from "~/components/ui/button";
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
    <header className="flex items-center justify-between">
      <nav aria-label="Social media" className="flex gap-2 pt-4 pl-6">
        {SOCIAL_LINKS.map((social) => (
          <a
            key={social.name}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.name}
            className={cn(
              buttonVariants({ size: "icon", variant: "ghost" }),
              "size-9",
            )}
          >
            <Image
              src={social.src}
              alt=""
              width={20}
              height={20}
              className="size-5 dark:invert"
            />
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-2 pt-4 pr-6">
        <a
          href={`https://blog.simverse.sh/${locale}`}
          className={cn(buttonVariants({ variant: "ghost" }), "h-9")}
        >
          {t("title")}
        </a>
        <HomeLocalePicker />
      </div>
    </header>
  );
}
