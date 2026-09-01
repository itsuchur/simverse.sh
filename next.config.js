/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const posthogIngestHost = (
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"
).replace(/\/$/, "");

const isDev = process.env.NODE_ENV !== "production";

/** @type {import("next").NextConfig} */
const config = {
  // Emit .next/standalone so the production Docker image can run without the
  // full node_modules tree (see Dockerfile runner stage).
  output: "standalone",
  outputFileTracingIncludes: {
    "/**": [
      "./TOS.md",
      "./PRIVACY-POLICY.md",
      "./REFUNDS.md",
      "./TOS.ru.md",
      "./PRIVACY-POLICY.ru.md",
      "./REFUNDS.ru.md",
    ],
  },
  images: {
    dangerouslyAllowLocalIP: isDev,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "1337",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "strapi",
        port: "1337",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "cms.simverse.sh",
        pathname: "/uploads/**",
      },
    ],
  },
  // Allow the ngrok tunnel host to hit the Next.js dev server (HMR/assets/API).
  allowedDevOrigins: ["magical-guinea-utterly.ngrok-free.app"],
  // PostHog ingest paths use trailing slashes; do not 308 them away.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const strapiOrigin = (
      process.env.STRAPI_URL ?? "http://localhost:1337"
    ).replace(/\/$/, "");
    return [
      {
        source: "/ingest/static/:path*",
        destination: `${posthogIngestHost}/static/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `${posthogIngestHost}/:path*`,
      },
      {
        source: "/cms-media/:path*",
        destination: `${strapiOrigin}/:path*`,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin({
  experimental: {
    createMessagesDeclaration: "./messages/en.json",
  },
});

export default withSentryConfig(withNextIntl(config), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "home-pau",
  project: "simversesh",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
