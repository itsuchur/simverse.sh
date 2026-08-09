/* eslint-disable @next/next/no-img-element -- Telegram avatar URLs are
   remote and short-lived; next/image optimization adds no value here. */
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { getSession } from "~/server/better-auth/server";

export default async function AppProfile() {
  // The /app layout gates rendering, but pages showing user data must not
  // rely on it — check the session where the data is used.
  const session = await getSession();

  if (!session) {
    return null;
  }

  const { user } = session;

  return (
    <main className="space-y-3 pt-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {user.image ? (
              <img
                src={user.image}
                alt=""
                className="border-border size-12 rounded-full border object-cover"
              />
            ) : (
              <div className="bg-muted flex size-12 items-center justify-center rounded-full text-lg font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <CardTitle>{user.name}</CardTitle>
              <CardDescription>
                Signed in with Telegram
                {user.isPremium ? " · Premium" : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Language and notification preferences will live here.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
