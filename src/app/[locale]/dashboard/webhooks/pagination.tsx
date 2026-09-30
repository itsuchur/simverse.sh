import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

import { webhookLogsHref, type WebhookSourceFilter } from "./source-tabs";

export function WebhookPagination({
  source,
  page,
  pageCount,
  total,
}: {
  source: WebhookSourceFilter;
  page: number;
  pageCount: number;
  total: number;
}) {
  if (total === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="text-muted-foreground text-sm">
        Page {page} of {pageCount} · {total} {total === 1 ? "event" : "events"}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button
            render={<Link href={webhookLogsHref(source, page - 1)} />}
            variant="outline"
            size="lg"
            className="h-10 flex-1 px-4 text-base sm:flex-none"
          >
            Previous
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            className="h-10 flex-1 px-4 text-base sm:flex-none"
            disabled
          >
            Previous
          </Button>
        )}
        {page < pageCount ? (
          <Button
            render={<Link href={webhookLogsHref(source, page + 1)} />}
            variant="outline"
            size="lg"
            className="h-10 flex-1 px-4 text-base sm:flex-none"
          >
            Next
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            className="h-10 flex-1 px-4 text-base sm:flex-none"
            disabled
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
