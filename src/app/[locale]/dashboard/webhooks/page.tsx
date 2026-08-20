import { db } from "~/server/db";

import { WebhookPagination } from "./pagination";
import {
  isWebhookSourceFilter,
  WebhookSourceTabs,
  type WebhookSourceFilter,
} from "./source-tabs";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const SENSITIVE_HEADER = /secret|token|authorization|cookie|api-key|apikey/i;

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  return JSON.stringify(value, null, 2);
}

function redactHeaders(headers: unknown) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return headers;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = SENSITIVE_HEADER.test(key) ? "[redacted]" : value;
  }
  return redacted;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined) {
  const n = Number.parseInt(firstParam(value) ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseSource(
  value: string | string[] | undefined,
): WebhookSourceFilter {
  const raw = firstParam(value);
  if (raw && isWebhookSourceFilter(raw)) {
    return raw;
  }
  return "all";
}

export default async function DashboardWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    source?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const source = parseSource(params.source);
  const requestedPage = parsePage(params.page);
  const where = source === "all" ? {} : { source };

  const total = await db.webhookLog.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const logs = await db.webhookLog.findMany({
    where,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    orderBy: { receivedAt: "desc" },
  });

  const showSource = source === "all";

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Webhooks</h1>
      <div className="flex items-start gap-6">
        <WebhookSourceTabs source={source} />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="ring-foreground/10 overflow-x-auto rounded-xl ring-1">
            <table className="w-full table-fixed border-separate border-spacing-0 text-left text-base">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="w-44 px-5 py-3.5 font-medium">Received</th>
                  {showSource ? (
                    <th className="w-36 px-5 py-3.5 font-medium">Source</th>
                  ) : null}
                  <th className="px-5 py-3.5 font-medium">Payload</th>
                  <th className="px-5 py-3.5 font-medium">Headers</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td
                      className="text-muted-foreground px-5 py-8"
                      colSpan={showSource ? 4 : 3}
                    >
                      No webhook logs yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const payload = formatJson(log.payload);
                    const headers = formatJson(redactHeaders(log.headers));
                    return (
                      <tr key={log.id.toString()} className="align-top">
                        <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                          {log.receivedAt
                            .toISOString()
                            .replace("T", " ")
                            .slice(0, 19)}
                        </td>
                        {showSource ? (
                          <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                            {log.source}
                          </td>
                        ) : null}
                        <td className="border-border border-t px-5 py-3.5">
                          {payload ? (
                            <pre className="bg-muted/40 max-h-56 overflow-auto rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">
                              {payload}
                            </pre>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="border-border border-t px-5 py-3.5">
                          {headers ? (
                            <pre className="bg-muted/40 max-h-56 overflow-auto rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">
                              {headers}
                            </pre>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <WebhookPagination
            source={source}
            page={page}
            pageCount={pageCount}
            total={total}
          />
        </div>
      </div>
    </main>
  );
}
