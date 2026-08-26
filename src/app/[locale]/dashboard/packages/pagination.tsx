import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

import { packagesHref, type PackageProvider } from "./provider-tabs";

export function PackagePagination({
  provider,
  query,
  page,
  pageCount,
  total,
}: {
  provider: PackageProvider;
  query: string;
  page: number;
  pageCount: number;
  total: number;
}) {
  if (total === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-muted-foreground text-sm">
        Page {page} of {pageCount} · {total}{" "}
        {total === 1 ? "package" : "packages"}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button
            render={<Link href={packagesHref(provider, query, page - 1)} />}
            variant="outline"
            size="lg"
            className="h-10 px-4 text-base"
          >
            Previous
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            className="h-10 px-4 text-base"
            disabled
          >
            Previous
          </Button>
        )}
        {page < pageCount ? (
          <Button
            render={<Link href={packagesHref(provider, query, page + 1)} />}
            variant="outline"
            size="lg"
            className="h-10 px-4 text-base"
          >
            Next
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            className="h-10 px-4 text-base"
            disabled
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
