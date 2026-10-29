import { requireDashboardSession } from "~/server/dashboard/access";
import { db } from "~/server/db";

import { TrafficSourcePagination } from "./pagination";
import { TrafficSourceCodes } from "./traffic-source-codes";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined) {
  const n = Number.parseInt(firstParam(value) ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function sourceRank(source: string) {
  if (source === "organic") return 0;
  if (source === "unknown") return 1;
  if (source === "unset") return 2;
  return 3;
}

function sortCounts(rows: Array<{ source: string; count: number }>) {
  return [...rows].sort((a, b) => {
    const rank = sourceRank(a.source) - sourceRank(b.source);
    return rank === 0 ? a.source.localeCompare(b.source) : rank;
  });
}

function CountTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ source: string; count: number }>;
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <div className="ring-foreground/10 overflow-x-auto rounded-xl ring-1">
          <table className="w-full text-left text-base">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5 font-medium">Source</th>
                <th className="px-5 py-3.5 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.source} className="border-t">
                  <td className="px-5 py-3 font-mono">{row.source}</td>
                  <td className="px-5 py-3">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function DashboardTrafficSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await requireDashboardSession();
  const params = await searchParams;
  const requestedPage = parsePage(params.page);

  const [codes, clickGroups, accountGroups, total] = await Promise.all([
    db.trafficSourceCode.findMany({ orderBy: { code: "asc" } }),
    db.telegramStartLog.groupBy({
      by: ["source"],
      _count: { _all: true },
    }),
    db.user.groupBy({
      by: ["acquisitionSource"],
      _count: { _all: true },
    }),
    db.telegramStartLog.count(),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const logs = await db.telegramStartLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });

  const clicks = sortCounts(
    clickGroups.map((group) => ({
      source: group.source,
      count: group._count._all,
    })),
  );
  const accounts = sortCounts(
    accountGroups.map((group) => ({
      source: group.acquisitionSource ?? "unset",
      count: group._count._all,
    })),
  );

  return (
    <main className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">Traffic Sources</h1>
      <TrafficSourceCodes codes={codes.map((row) => row.code)} />
      <div className="grid gap-8 lg:grid-cols-2">
        <CountTable
          title="/start clicks"
          rows={clicks}
          empty="No /start clicks yet."
        />
        <CountTable
          title="Accounts"
          rows={accounts}
          empty="No accounts yet."
        />
      </div>
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Click log</h2>
        <TrafficSourcePagination page={page} pageCount={pageCount} total={total} />
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No /start clicks yet.</p>
        ) : (
          <div className="ring-foreground/10 overflow-x-auto rounded-xl ring-1">
            <table className="w-full min-w-[40rem] text-left text-base">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Time</th>
                  <th className="px-5 py-3.5 font-medium">Telegram</th>
                  <th className="px-5 py-3.5 font-medium">Payload</th>
                  <th className="px-5 py-3.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id.toString()} className="border-t">
                    <td className="px-5 py-3 whitespace-nowrap">
                      {log.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-5 py-3 font-mono">{log.telegramId}</td>
                    <td className="px-5 py-3 font-mono">
                      {log.payload === "" ? "—" : log.payload}
                    </td>
                    <td className="px-5 py-3 font-mono">{log.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
