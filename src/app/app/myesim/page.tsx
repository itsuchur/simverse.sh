import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";


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
