import "server-only";

import { getSession } from "~/server/better-auth/server";
import { isDashboardEmail } from "~/server/dashboard/emails";

export {
  DASHBOARD_ALLOWED_EMAIL,
  isAllowedAuthEmail,
  isDashboardEmail,
} from "./emails";

export async function requireDashboardSession() {
  const session = await getSession();
  if (!session || !isDashboardEmail(session.user.email)) {
    throw new Error("Unauthorized");
  }
  return session;
}
