import {
  ESIMACCESS_PRICE_SCALE,
  getCachedEsimAccessPackages,
  searchEsimAccessPackageCodes,
  type EsimAccessPackage,
} from "~/server/suppliers/esimaccess/packages";

import { PackagePagination } from "./pagination";
import {
  isPackageProvider,
  PackageProviderTabs,
  type PackageProvider,
} from "./provider-tabs";
import { PackageSearchForm } from "./search-form";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const LOCATION_PREVIEW = 6;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined) {
  const n = Number.parseInt(firstParam(value) ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseProvider(value: string | string[] | undefined): PackageProvider {
  const raw = firstParam(value);
  if (raw && isPackageProvider(raw)) {
    return raw;
  }
  return "esimaccess";
}

function parseQuery(value: string | string[] | undefined) {
  return (firstParam(value) ?? "").trim();
}

function formatVolume(bytes: number) {
  const gib = bytes / 1024 ** 3;
  if (gib >= 1) {
    return Number.isInteger(gib) ? `${gib} GB` : `${gib.toFixed(1)} GB`;
  }
  const mib = bytes / 1024 ** 2;
  return `${Math.round(mib)} MB`;
}

function formatUsd(scaled: number) {
  if (!Number.isFinite(scaled)) {
    return "—";
  }
  return `$${(scaled / ESIMACCESS_PRICE_SCALE).toFixed(2)}`;
}

function formatLocation(location: string) {
  const codes = location.split(",").filter(Boolean);
  if (codes.length === 0) {
    return "—";
  }
  if (codes.length <= LOCATION_PREVIEW) {
    return codes.join(", ");
  }
  return `${codes.slice(0, LOCATION_PREVIEW).join(", ")} +${codes.length - LOCATION_PREVIEW}`;
}

function formatSyncedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export default async function DashboardPackagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    provider?: string | string[];
    q?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const provider = parseProvider(params.provider);
  const query = parseQuery(params.q);
  const requestedPage = parsePage(params.page);

  const cached = await getCachedEsimAccessPackages();

  let packages: EsimAccessPackage[] = cached?.packageList ?? [];
  if (query) {
    const codes = await searchEsimAccessPackageCodes(query);
    if (codes !== null) {
      const matching = new Set(codes);
      packages = packages.filter((pkg) => matching.has(pkg.packageCode));
    }
  }

  packages.sort((a, b) => a.name.localeCompare(b.name));

  const total = packages.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const pagePackages = packages.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const emptyMessage = cached
    ? query
      ? "No matching packages."
      : "No packages in Redis."
    : "No packages in Redis.";

  return (
    <main className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Packages</h1>
        {cached ? (
          <p className="text-muted-foreground text-sm">
            Last sync {formatSyncedAt(cached.syncedAt)} · {cached.count} in
            catalog
            {query ? ` · ${total} match${total === 1 ? "" : "es"}` : null}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Catalog has not been synced yet.
          </p>
        )}
      </div>
      <div className="flex items-start gap-6">
        <PackageProviderTabs provider={provider} query={query} />
        <div className="min-w-0 flex-1 space-y-4">
          <PackageSearchForm provider={provider} query={query} />
          <div className="ring-foreground/10 overflow-x-auto rounded-xl ring-1">
            <table className="w-max min-w-full border-separate border-spacing-0 text-left text-base">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Code</th>
                  <th className="px-5 py-3.5 font-medium">Name</th>
                  <th className="px-5 py-3.5 font-medium">Location</th>
                  <th className="px-5 py-3.5 font-medium">Data</th>
                  <th className="px-5 py-3.5 font-medium">Duration</th>
                  <th className="px-5 py-3.5 font-medium">Cost</th>
                  <th className="px-5 py-3.5 font-medium">Retail</th>
                  <th className="px-5 py-3.5 font-medium">RUB</th>
                  <th className="px-5 py-3.5 font-medium">Stars</th>
                </tr>
              </thead>
              <tbody>
                {pagePackages.length === 0 ? (
                  <tr>
                    <td className="text-muted-foreground px-5 py-8" colSpan={9}>
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  pagePackages.map((pkg) => (
                    <tr key={pkg.packageCode} className="align-top">
                      <td className="border-border border-t px-5 py-3.5 font-mono text-sm whitespace-nowrap">
                        {pkg.packageCode}
                      </td>
                      <td className="border-border min-w-48 border-t px-5 py-3.5">
                        <div>{pkg.name}</div>
                        {pkg.nameRu ? (
                          <div className="text-muted-foreground text-sm">
                            {pkg.nameRu}
                          </div>
                        ) : null}
                      </td>
                      <td className="border-border max-w-72 border-t px-5 py-3.5 font-mono text-sm">
                        {formatLocation(pkg.location)}
                      </td>
                      <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                        {formatVolume(pkg.volume)}
                      </td>
                      <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                        {pkg.duration} {pkg.durationUnit}
                      </td>
                      <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                        {formatUsd(pkg.price)}
                      </td>
                      <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                        {formatUsd(pkg.retailPrice)}
                      </td>
                      <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                        {pkg.priceRub ?? "—"}
                      </td>
                      <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                        {pkg.priceStars ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PackagePagination
            provider={provider}
            query={query}
            page={page}
            pageCount={pageCount}
            total={total}
          />
        </div>
      </div>
    </main>
  );
}
