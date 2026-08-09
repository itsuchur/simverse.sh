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

  return (
    <main className="pt-2">
      <Card>
        <CardHeader>
          <CardTitle>My eSIMs</CardTitle>
          <CardDescription>
            Your installed and purchased eSIMs will appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
