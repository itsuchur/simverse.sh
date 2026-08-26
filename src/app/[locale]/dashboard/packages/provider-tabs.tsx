import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

export const PACKAGE_PROVIDERS = ["esimaccess"] as const;

export type PackageProvider = (typeof PACKAGE_PROVIDERS)[number];

export const PACKAGE_PROVIDER_LABELS: Record<PackageProvider, string> = {
  esimaccess: "eSIM Access",
};

export function isPackageProvider(value: string): value is PackageProvider {
  return (PACKAGE_PROVIDERS as readonly string[]).includes(value);
}

export function packagesHref(provider: PackageProvider, query = "", page = 1) {
  const params = new URLSearchParams();
  if (provider !== "esimaccess") {
    params.set("provider", provider);
  }
  const q = query.trim();
  if (q) {
    params.set("q", q);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const search = params.toString();
  return search ? `/dashboard/packages?${search}` : "/dashboard/packages";
}

export function PackageProviderTabs({
  provider,
  query,
}: {
  provider: PackageProvider;
  query: string;
}) {
  return (
    <nav aria-label="eSIM provider" className="flex w-44 flex-col gap-1">
      {PACKAGE_PROVIDERS.map((value) => {
        const active = value === provider;
        return (
          <Link
            key={value}
            href={packagesHref(value, query)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            {PACKAGE_PROVIDER_LABELS[value]}
          </Link>
        );
      })}
    </nav>
  );
}
