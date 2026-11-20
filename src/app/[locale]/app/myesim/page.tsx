import { getSession } from "~/server/better-auth/server";
import { loadMyEsims } from "~/server/orders/my-esims";

import { MyEsimList } from "./myesim-list";

export const dynamic = "force-dynamic";

export default async function AppMyESIms() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const { orders, refreshLifecycle } = await loadMyEsims(session.user.id);

  return (
    <main className="flex flex-1 flex-col py-4">
      <MyEsimList orders={orders} refreshLifecycle={refreshLifecycle} />
    </main>
  );
}
