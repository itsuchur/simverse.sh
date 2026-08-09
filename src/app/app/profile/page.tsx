import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export default function AppProfile() {
  return (
    <main className="pt-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Account details and preferences will live here.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
