import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import type { ComponentProps, ReactNode } from "react";

if (typeof document === "undefined") {
  const browser = new Window({ url: "http://localhost/en/app" });
  for (const key of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLInputElement",
    "Node",
    "MutationObserver",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ]) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: key === "window" ? browser : browser[key as "document"],
    });
  }
}
const refresh = mock(() => undefined);
const signIn = mock(async () => ({ data: {}, error: null }));
const router = { refresh };
void mock.module("~/i18n/navigation", () => ({ useRouter: () => router }));
void mock.module("~/lib/auth-client", () => ({
  autoSignInFromMiniApp: signIn,
}));
void mock.module("~/lib/telegram-webapp", () => ({
  waitForTelegramInitData: async () => "signed-initdata",
}));
// Test gate decisions independently of the shared dialog's portals/focus behavior.
const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
const Action = (props: ComponentProps<"button">) => <button {...props} />;
void mock.module("~/components/ui/alert-dialog", () => ({
  AlertDialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="alertdialog">{children}</div> : null,
  AlertDialogContent: Box,
  AlertDialogHeader: Box,
  AlertDialogTitle: Box,
  AlertDialogDescription: Box,
  AlertDialogFooter: Box,
  AlertDialogAction: Action,
  AlertDialogCancel: Action,
}));
const { render, cleanup, fireEvent, within, waitFor } =
  await import("@testing-library/react");
const { NextIntlClientProvider } = await import("next-intl");
const messages = (await import("../../../../../messages/en.json")).default;
const { AuthGate } = await import("./auth-gate");
const originalFetch = globalThis.fetch;
let deleted = true;
let restoreStatus = 204;
const requests: { path: string; body?: unknown }[] = [];
beforeEach(() => {
  signIn.mockClear();
  refresh.mockClear();
  requests.length = 0;
  deleted = true;
  restoreStatus = 204;
  globalThis.fetch = (async (path: unknown, init?: RequestInit) => {
    if (typeof path !== "string") throw new Error("Expected URL");
    requests.push({
      path,
      body:
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as unknown)
          : undefined,
    });
    return path.endsWith("precheck")
      ? Response.json({ requiresRestoration: deleted })
      : new Response(null, { status: restoreStatus });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
function mount() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthGate />
    </NextIntlClientProvider>,
  );
}

test("deleted account asks before sign-in; declining stays signed out", async () => {
  const view = mount();
  const dialog = await view.findByRole("alertdialog");
  expect(signIn).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Keep account deleted" }),
  );
  expect(view.queryByRole("alertdialog")).toBeNull();
  expect(view.getByText(messages.Auth.accountDeleted)).toBeTruthy();
  expect(signIn).not.toHaveBeenCalled();
  expect(
    requests.filter((request) => request.path.endsWith("restore")),
  ).toHaveLength(0);
});

test("restoration signs in and confirms explicitly before refreshing", async () => {
  const view = mount();
  const dialog = await view.findByRole("alertdialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Restore account" }),
  );
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(signIn).toHaveBeenCalledTimes(1);
  expect(
    requests.find((request) => request.path.endsWith("restore"))?.body,
  ).toEqual({ confirmed: true });
});

test("active or new account signs in without restoration", async () => {
  deleted = false;
  mount();
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(signIn).toHaveBeenCalledTimes(1);
  expect(requests).toHaveLength(1);
});

test("failed restoration shows an error and does not refresh into the app", async () => {
  restoreStatus = 503;
  const view = mount();
  const dialog = await view.findByRole("alertdialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Restore account" }),
  );
  await view.findByText(messages.Auth.reasonNetwork);
  expect(refresh).not.toHaveBeenCalled();
});
