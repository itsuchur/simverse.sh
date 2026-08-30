import type { Core } from "@strapi/strapi";

const PUBLIC_ARTICLE_ACTIONS = [
  "api::article.article.find",
  "api::article.article.findOne",
];

async function ensureRussianLocale(strapi: Core.Strapi) {
  const localesService = strapi.plugin("i18n").service("locales");
  const locales = (await localesService.find()) as Array<{ code: string }>;
  if (locales.some((locale) => locale.code === "ru")) {
    return;
  }
  await localesService.create({
    code: "ru",
    name: "Russian (ru)",
  });
  strapi.log.info("Added i18n locale ru");
}

async function ensurePublicArticlePermissions(strapi: Core.Strapi) {
  const publicRole = await strapi
    .query("plugin::users-permissions.role")
    .findOne({ where: { type: "public" } });

  if (!publicRole) {
    strapi.log.warn("Public role not found; skip article permissions");
    return;
  }

  for (const action of PUBLIC_ARTICLE_ACTIONS) {
    const existing = await strapi
      .query("plugin::users-permissions.permission")
      .findOne({
        where: {
          action,
          role: publicRole.id,
        },
      });

    if (!existing) {
      await strapi.query("plugin::users-permissions.permission").create({
        data: {
          action,
          role: publicRole.id,
        },
      });
      strapi.log.info(`Created public permission ${action}`);
      continue;
    }

    if (existing.enabled === false) {
      await strapi.query("plugin::users-permissions.permission").update({
        where: { id: existing.id },
        data: { enabled: true },
      });
      strapi.log.info(`Enabled public permission ${action}`);
    }
  }
}

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureRussianLocale(strapi);
    await ensurePublicArticlePermissions(strapi);
  },
};
