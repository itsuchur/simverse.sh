import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function AppMyESIms() {
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
