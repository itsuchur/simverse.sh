import { isDashboardEmail } from "~/server/dashboard/emails";
import { db } from "~/server/db";

import { BanUserButton } from "./ban-user-button";

export const dynamic = "force-dynamic";

export default async function DashboardUsersPage() {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      telegramId: true,
      telegramUsername: true,
      fingerprint: true,
      isBanned: true,
      createdAt: true,
    },
  });

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
      <div className="ring-foreground/10 overflow-x-auto rounded-xl ring-1">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-base">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-5 py-3.5 font-medium">Created</th>
              <th className="px-5 py-3.5 font-medium">Name</th>
              <th className="px-5 py-3.5 font-medium">Telegram</th>
              <th className="px-5 py-3.5 font-medium">Email</th>
              <th className="px-5 py-3.5 font-medium">Fingerprint</th>
              <th className="px-5 py-3.5 font-medium">Banned</th>
              <th className="px-5 py-3.5 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td className="text-muted-foreground px-5 py-8" colSpan={7}>
                  No users yet.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {user.createdAt
                      .toISOString()
                      .replace("T", " ")
                      .slice(0, 19)}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {user.name}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {user.telegramUsername
                      ? `@${user.telegramUsername}`
                      : (user.telegramId ?? "—")}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {user.email}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 font-mono text-sm whitespace-nowrap">
                    {user.fingerprint ?? "—"}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {user.isBanned ? "Yes" : "No"}
                  </td>
                  <td className="border-border border-t px-5 py-3.5">
                    {isDashboardEmail(user.email) ? null : (
                      <BanUserButton
                        userId={user.id}
                        isBanned={user.isBanned === true}
                      />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
