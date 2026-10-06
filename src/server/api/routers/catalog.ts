import { z } from "zod";

import { routing } from "~/i18n/routing";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  getStoreCatalog,
  searchEsimAccessPackageCodes,
} from "~/server/suppliers/esimaccess/packages";

export const catalogRouter = createTRPCRouter({
  /**
   * RediSearch-backed catalog search. Returns the package codes matching the
   * query, or null when the query has no searchable tokens (do not filter).
   */
  search: protectedProcedure
    .input(z.object({ query: z.string().trim().min(1).max(100) }))
    .query(({ input }) => searchEsimAccessPackageCodes(input.query)),

  /**
   * Local or regional/global slices of the shaped catalog. Popular is rendered
   * with the home page so the first payload stays small.
   */
  browse: protectedProcedure
    .input(
      z.object({
        locale: z.enum(routing.locales),
        scope: z.enum(["local", "regional"]),
      }),
    )
    .query(async ({ input }) => {
      const catalog = await getStoreCatalog(input.locale);
      if (input.scope === "local") {
        return { scope: "local" as const, local: catalog.local };
      }
      return {
        scope: "regional" as const,
        regional: catalog.regional,
        global: catalog.global,
      };
    }),
});
