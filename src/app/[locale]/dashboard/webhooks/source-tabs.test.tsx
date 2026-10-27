import { expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

void mock.module("~/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
    "aria-current": ariaCurrent,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "aria-current"?: "page";
  }) => (
    <a href={href} className={className} aria-current={ariaCurrent}>
      {children}
    </a>
  ),
}));

const { WebhookSourceTabs, isWebhookSourceFilter, webhookLogsHref } =
  await import("./source-tabs");

test("unitpay is a dedicated webhook source", () => {
  expect(isWebhookSourceFilter("unitpay")).toBe(true);
  expect(webhookLogsHref("unitpay", 2, "987")).toBe(
    "/dashboard/webhooks?q=987&source=unitpay&page=2",
  );
  const html = renderToStaticMarkup(<WebhookSourceTabs source="unitpay" />);
  expect(html).toContain(">Unitpay<");
  expect(html).toContain('href="/dashboard/webhooks?source=unitpay"');
  expect(html).toContain('aria-current="page"');
});
