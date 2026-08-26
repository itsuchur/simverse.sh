import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import type { PackageProvider } from "./provider-tabs";

export function PackageSearchForm({
  provider,
  query,
}: {
  provider: PackageProvider;
  query: string;
}) {
  return (
    <form
      action="/dashboard/packages"
      method="get"
      className="flex max-w-xl items-center gap-2"
    >
      {provider !== "esimaccess" ? (
        <input type="hidden" name="provider" value={provider} />
      ) : null}
      <Input
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Search packages"
        aria-label="Search packages"
        className="h-10 text-base md:text-base"
      />
      <Button type="submit" size="lg" className="h-10 px-4 text-base">
        Search
      </Button>
    </form>
  );
}
