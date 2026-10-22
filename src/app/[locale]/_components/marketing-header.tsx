import Image from "next/image";

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

export function MarketingHeader() {
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
      <HomeLocalePicker />
    </header>
  );
}
