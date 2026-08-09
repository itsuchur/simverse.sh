import { PackageCatalog } from "~/app/app/_components/package-catalog";
import { getPopularPackagesByCountry } from "~/server/suppliers/esimaccess/packages";

export default async function AppHome() {
  const popular = await getPopularPackagesByCountry();

  return <PackageCatalog popular={popular} />;
}
