import type { Prisma } from "@prisma/client";
import { Link } from "~/i18n/navigation";
import { formatOrderPrice } from "~/lib/format-order-price";
import { REFUND_STATUSES } from "~/lib/refund-status";
import { db } from "~/server/db";
import { requireDashboardSession } from "~/server/dashboard/access";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
const labels: Record<string, string> = {
  requested: "Requested",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  reversed: "Reversed",
  manual_review: "Manual review",
};
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const date = (value: Date | null) =>
  value ? value.toISOString().replace("T", " ").slice(0, 19) + " UTC" : "—";

export default async function DashboardRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    page?: string | string[];
  }>;
}) {
  await requireDashboardSession();
  const params = await searchParams;
  const rawStatus = first(params.status);
  const status = REFUND_STATUSES.find((status) => status === rawStatus);
  const where: Prisma.RefundWhereInput = status ? { status } : {};
  const total = await db.refund.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rawPage = Number(first(params.page) ?? 1);
  const page = Math.min(
    Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageCount,
  );
  const refunds = await db.refund.findMany({
    where,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      order: {
        select: {
          orderUuid: true,
          packageName: true,
          topupOfOrderId: true,
          user: {
            select: { name: true, telegramId: true, telegramUsername: true },
          },
        },
      },
      requestedBy: { select: { name: true, email: true } },
    },
  });
  const pageHref = (next: number) =>
    `/dashboard/refunds?page=${next}${status ? `&status=${status}` : ""}`;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Refunds</h1>
          <p className="text-muted-foreground mt-2">
            Full-order refund requests and their provider-confirmed status.
          </p>
        </div>
        <form className="flex items-center gap-3">
          <label htmlFor="refund-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="refund-status"
            name="status"
            defaultValue={status ?? "all"}
            className="border-border bg-background rounded-lg border px-3 py-2"
          >
            <option value="all">All statuses</option>
            {REFUND_STATUSES.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
          <button className="bg-muted hover:bg-muted/70 rounded-lg px-4 py-2 font-medium">
            Filter
          </button>
        </form>
      </div>
      <p className="text-muted-foreground text-sm">
        {total} refund{total === 1 ? "" : "s"} · Page {page} of {pageCount} ·
        Times in UTC
      </p>
      {refunds.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          No refunds match this filter.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {refunds.map((refund) => {
            const user = refund.order.user;
            return (
              <article
                key={refund.id}
                className="ring-foreground/10 space-y-4 rounded-xl p-5 ring-1"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">
                      {refund.order.packageName}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {refund.order.topupOfOrderId ? "Top-up" : "eSIM"} ·{" "}
                      {user.telegramUsername
                        ? `@${user.telegramUsername}`
                        : user.name}
                      {user.telegramId ? ` (${user.telegramId})` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      {formatOrderPrice(
                        refund.amount,
                        refund.currency,
                        refund.provider,
                      )}
                    </p>
                    <p className="text-sm font-medium">
                      {labels[refund.status] ?? refund.status}
                    </p>
                  </div>
                </div>
                <p className="break-words">{refund.reason}</p>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Requested</dt>
                  <dd>{date(refund.createdAt)}</dd>
                  <dt className="text-muted-foreground">Updated</dt>
                  <dd>{date(refund.updatedAt)}</dd>
                  <dt className="text-muted-foreground">Completed</dt>
                  <dd>{date(refund.completedAt)}</dd>
                  <dt className="text-muted-foreground">Initiator</dt>
                  <dd className="break-words">
                    {refund.requestedBy
                      ? `${refund.requestedBy.name} (${refund.requestedBy.email})`
                      : refund.source === "legacy"
                        ? "Migrated record · initiator not recorded"
                        : refund.source === "automatic"
                          ? "Automatic refund"
                          : refund.source === "dashboard"
                            ? "Dashboard · staff account unavailable"
                            : "Payment provider"}
                  </dd>
                  <dt className="text-muted-foreground">Provider</dt>
                  <dd>
                    {refund.provider}
                    {refund.providerStatus ? ` · ${refund.providerStatus}` : ""}
                  </dd>
                  <dt className="text-muted-foreground">Payment ID</dt>
                  <dd className="font-mono break-all">
                    {refund.providerPaymentId ?? "—"}
                  </dd>
                  <dt className="text-muted-foreground">Provider refund ID</dt>
                  <dd className="font-mono break-all">
                    {refund.providerRefundId ?? "—"}
                  </dd>
                  <dt className="text-muted-foreground">Request ID</dt>
                  <dd className="font-mono break-all">{refund.id}</dd>
                  {refund.failureCode ? (
                    <>
                      <dt className="text-muted-foreground">Needs review</dt>
                      <dd className="break-words">{refund.failureCode}</dd>
                    </>
                  ) : null}
                </dl>
                <Link
                  href={`/dashboard/orders?order=${refund.order.orderUuid}`}
                  className="text-sm font-medium underline underline-offset-4"
                >
                  View order
                </Link>
                {refund.source === "legacy" ? (
                  <p className="text-muted-foreground text-xs">
                    Historical request and completion times were not recorded;
                    migrated timestamps use the order’s last update.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      <nav
        aria-label="Refund pages"
        className="flex items-center justify-between"
      >
        {page > 1 ? (
          <Link
            href={pageHref(page - 1)}
            className="rounded-lg px-4 py-2 underline"
          >
            Previous
          </Link>
        ) : (
          <span />
        )}
        {page < pageCount ? (
          <Link
            href={pageHref(page + 1)}
            className="rounded-lg px-4 py-2 underline"
          >
            Next
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
