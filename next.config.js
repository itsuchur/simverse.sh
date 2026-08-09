/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Allow the ngrok tunnel host to hit the Next.js dev server (HMR/assets/API).
  allowedDevOrigins: ["magical-guinea-utterly.ngrok-free.app"],
};

export default config;
