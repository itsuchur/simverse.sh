import { expect, test } from "bun:test";

// Separate processes avoid the auth mocks installed by checkout tests.
test("auth route collection does not initialize auth without build credentials", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "--no-env-file",
      "--conditions=react-server",
      "-e",
      'const { getAuth } = await import("./src/server/better-auth/config.ts"); console.log(typeof getAuth);',
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        SKIP_ENV_VALIDATION: "1",
        BETTER_AUTH_SECRET: "",
        AUTH_SECRET: "",
        TELEGRAM_BOT_TOKEN: "",
        TELEGRAM_BOT_USERNAME: "",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(code).toBe(0);
  expect(stdout.trim()).toBe("function");
  expect(stderr).toBe("");
});

test("runtime credential validation is not bypassed by SKIP_ENV_VALIDATION=0", async () => {
  const child = Bun.spawn(
    [process.execPath, "--no-env-file", "-e", 'await import("./src/env.js");'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        SKIP_ENV_VALIDATION: "0",
        BETTER_AUTH_SECRET: "",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stderr, code] = await Promise.all([
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(code).not.toBe(0);
  expect(stderr).toContain("BETTER_AUTH_SECRET");
});
