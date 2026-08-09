import { PackageCatalog } from "~/app/app/_components/package-catalog";
import { getPopularPackagesByCountry } from "~/server/suppliers/esimaccess/packages";

// The catalog is refreshed hourly in Redis; render it per-request instead of
// freezing it into static HTML at build time (which would also require a
// reachable Redis during `next build`).
export const dynamic = "force-dynamic";

export default async function AppHome() {
  const popular = await getPopularPackagesByCountry();

  return <PackageCatalog popular={popular} />;
}
