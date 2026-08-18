import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { searchEsimAccessPackageCodes } from "~/server/suppliers/esimaccess/packages";

export const catalogRouter = createTRPCRouter({
  /**
   * RediSearch-backed catalog search. Returns the package codes matching the
   * query, or null when the query has no searchable tokens (do not filter).
   */
  search: protectedProcedure
    .input(z.object({ query: z.string().trim().min(1).max(100) }))
    .query(({ input }) => searchEsimAccessPackageCodes(input.query)),
});
