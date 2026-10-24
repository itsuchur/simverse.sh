import type { Core } from "@strapi/strapi";

const config: Core.Config.Middlewares = [
  "strapi::logger",
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "img-src": [
            "'self'",
            "data:",
            "blob:",
            "market-assets.strapi.io",
            "https://img.youtube.com",
          ],
          "media-src": ["'self'", "data:", "blob:"],
          "frame-src": [
            "'self'",
            "https://www.youtube.com",
            "https://player.vimeo.com",
            "https://www.loom.com",
            "https://fast.wistia.net",
            "https://www.dailymotion.com",
            "https://embed.api.video",
          ],
        },
      },
    },
  },
  "strapi::cors",
  "strapi::poweredBy",
  "strapi::query",
  "strapi::body",
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];

export default config;
