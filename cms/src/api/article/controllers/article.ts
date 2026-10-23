import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::article.article",
  ({ strapi }) => ({
    async find(ctx) {
      const { tag, ...query } = ctx.query;
      ctx.query = query;
      if (tag !== undefined) {
        if (typeof tag !== "string" || !tag.trim() || tag.length > 200) {
          return ctx.badRequest(
            "tag must be a non-empty string of at most 200 characters",
          );
        }
        // JSON tags require an exact array-member match, not a text substring.
        const rows: { id: number }[] = await strapi.db
          .connection("articles")
          .select("id")
          .whereJsonSupersetOf("tags", [{ name: tag.trim() }]);
        ctx.query.filters = {
          $and: [
            query.filters ?? {},
            { id: { $in: rows.map(({ id }) => id) } },
          ],
        };
      }
      return super.find(ctx);
    },
  }),
);
