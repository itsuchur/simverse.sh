import { beforeEach, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb } from "~/test/fake-db";

let authorized = true;
const count = mock(async (_args: unknown) => 41);
const findMany = mock(async (_args: unknown) => [
  {
    id: "refund-1",
    amount: 50000n,
    currency: "RUB",
    provider: "xhub",
    status: "processing",
    providerStatus: "requested",
    reason: "Customer <script>input</script>",
    source: "dashboard",
    providerPaymentId: "pay-1",
    providerRefundId: "ref-1",
    failureCode: null,
    createdAt: new Date("2026-10-24T12:00:00Z"),
    updatedAt: new Date("2026-10-24T12:01:00Z"),
    completedAt: null,
    requestedBy: { name: "Staff", email: "support@example.test" },
    order: {
      orderUuid: "order-1",
      packageName: "Japan 1GB",
      topupOfOrderId: null,
      user: { name: "Buyer", telegramId: "42", telegramUsername: "buyer" },
    },
  },
]);
Object.assign(fakeDb.refund, { count, findMany });
void mock.module("~/server/dashboard/access", () => ({
  requireDashboardSession: async () => {
    if (!authorized) throw new Error("Unauthorized");
    return { user: { id: "staff-1" } };
  },
}));
void mock.module("~/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
const { default: RefundsPage } =
  await import("~/app/[locale]/dashboard/refunds/page");

beforeEach(() => {
  authorized = true;
  count.mockClear();
  count.mockResolvedValue(41);
  findMany.mockClear();
});

test("refunds page filters and paginates records, links to orders and escapes user content", async () => {
  const html = renderToStaticMarkup(
    await RefundsPage({
      searchParams: Promise.resolve({ status: "processing", page: "2" }),
    }),
  );
  expect(count).toHaveBeenCalledWith({ where: { status: "processing" } });
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      take: 20,
      skip: 20,
      where: { status: "processing" },
    }),
  );
  expect(html).toContain("Refunds");
  expect(html).toContain("Japan 1GB");
  expect(html).toContain("Staff (support@example.test)");
  expect(html).toContain("/dashboard/orders?order=order-1");
  expect(html).toContain("page=1&amp;status=processing");
  expect(html).toContain("page=3&amp;status=processing");
  expect(html).toContain("&lt;script&gt;input&lt;/script&gt;");
  expect(html).not.toContain("<script>");
});

test("invalid filters and oversized page numbers are constrained to valid query values", async () => {
  await RefundsPage({
    searchParams: Promise.resolve({
      status: "injected",
      page: "99999999999999999999999",
    }),
  });
  expect(count).toHaveBeenCalledWith({ where: {} });
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({ skip: 0, where: {} }),
  );
});

test("unauthorized requests cannot query refund records", async () => {
  authorized = false;
  const error = await RefundsPage({ searchParams: Promise.resolve({}) }).catch(
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(Error);
  expect(count).not.toHaveBeenCalled();
  expect(findMany).not.toHaveBeenCalled();
});
