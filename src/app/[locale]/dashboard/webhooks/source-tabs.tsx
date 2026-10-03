import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

export const WEBHOOK_SOURCES = [
  "all",
  "telegram",
  "esimaccess",
  "trybit",
  "platega",
  "cardlink",
] as const;

export type WebhookSourceFilter = (typeof WEBHOOK_SOURCES)[number];

export const WEBHOOK_SOURCE_LABELS: Record<WebhookSourceFilter, string> = {
  all: "All",
  telegram: "Telegram",
  esimaccess: "eSIM Access",
  trybit: "Trybit",
  platega: "Platega",
  cardlink: "Cardlink",
};

export function isWebhookSourceFilter(
  value: string,
): value is WebhookSourceFilter {
  return (WEBHOOK_SOURCES as readonly string[]).includes(value);
}

export function webhookLogsHref(source: WebhookSourceFilter, page = 1) {
  const params = new URLSearchParams();
  if (source !== "all") {
    params.set("source", source);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/dashboard/webhooks?${query}` : "/dashboard/webhooks";
}

export function WebhookSourceTabs({ source }: { source: WebhookSourceFilter }) {
  return (
    <nav
      aria-label="Webhook source"
      className="flex w-full gap-1 overflow-x-auto pb-1 md:w-44 md:flex-col md:overflow-visible md:pb-0"
    >
      {WEBHOOK_SOURCES.map((value) => {
        const active = value === source;
        return (
          <Link
            key={value}
            href={webhookLogsHref(value)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-sm font-medium md:py-1.5",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            {WEBHOOK_SOURCE_LABELS[value]}
          </Link>
        );
      })}
    </nav>
  );
}
