import { PackageCatalog } from "./_components/package-catalog";
import { getSession } from "~/server/better-auth/server";
import { getPopularPackagesByCountry } from "~/server/suppliers/esimaccess/packages";

// The catalog is refreshed hourly in Redis; render it per-request instead of
// freezing it into static HTML at build time (which would also require a
// reachable Redis during `next build`).
export const dynamic = "force-dynamic";

export default async function AppHome() {
  // Pages render in parallel with the layout, so the layout's session gate
  // does not keep page output out of the response payload. Authorize where
  // the data is fetched.
  const session = await getSession();
  if (!session) {
    return null;
  }

  const popular = await getPopularPackagesByCountry();

  return <PackageCatalog popular={popular} />;
}
