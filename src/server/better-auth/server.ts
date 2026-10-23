import { getAuth } from ".";
import { headers } from "next/headers";
import { cache } from "react";

export const getSession = cache(async () => {
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});
