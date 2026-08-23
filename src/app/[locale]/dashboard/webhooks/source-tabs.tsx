import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

export const WEBHOOK_SOURCES = [
  "all",
  "telegram",
  "esimaccess",
  "trybit",
  "cardlink",
] as const;

export type WebhookSourceFilter = (typeof WEBHOOK_SOURCES)[number];

export const WEBHOOK_SOURCE_LABELS: Record<WebhookSourceFilter, string> = {
  all: "All",
  telegram: "Telegram",
  esimaccess: "eSIM Access",
  trybit: "Trybit",
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
    <nav aria-label="Webhook source" className="flex w-44 flex-col gap-1">
      {WEBHOOK_SOURCES.map((value) => {
        const active = value === source;
        return (
          <Link
            key={value}
            href={webhookLogsHref(value)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
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
