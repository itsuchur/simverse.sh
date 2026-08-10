import { getTranslations } from "next-intl/server";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { getSession } from "~/server/better-auth/server";

export default async function AppMyESIms() {
  // Pages render in parallel with the layout, so the layout's session gate
  // does not keep page output out of the response payload. Check here too.
  const session = await getSession();
  if (!session) {
    return null;
  }

  const t = await getTranslations("MyEsims");

  return (
    <main className="pt-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
