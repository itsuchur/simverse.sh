import { searchWebhookLogs } from "~/server/dashboard/webhook-search";
import { requireDashboardSession } from "~/server/dashboard/access";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

import { WebhookPagination } from "./pagination";
import {
  isWebhookSourceFilter,
  WebhookSourceTabs,
  webhookLogsHref,
  type WebhookSourceFilter,
} from "./source-tabs";
import { WebhookLogCard } from "./webhook-log-card";

export const dynamic = "force-dynamic";

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
    q?: string | string[];
  }>;
}) {
  await requireDashboardSession();
  const params = await searchParams;
  const source = parseSource(params.source);
  const requestedPage = parsePage(params.page);
  const query = (firstParam(params.q) ?? "").trim().slice(0, 200);
  const { total, pageCount, page, logs } = await searchWebhookLogs(source, query, requestedPage);

  const showSource = source === "all";

  const records = logs.map((log) => ({
    id: log.id.toString(),
    receivedAt: log.receivedAt.toISOString().replace("T", " ").slice(0, 19),
    source: log.source,
    payload: formatJson(log.payload),
    headers: formatJson(redactHeaders(log.headers)),
  }));

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Webhooks</h1>
      <form method="get" className="flex flex-wrap items-end gap-2">
        {source !== "all" && <input type="hidden" name="source" value={source} />}
        <div className="min-w-60 flex-1 space-y-2">
          <label htmlFor="webhook-search" className="text-sm font-medium">Search webhooks</label>
          <Input key={query} id="webhook-search" name="q" type="search" defaultValue={query} maxLength={200} placeholder="Order ID, payment ID, ICCID, status, or payload text" />
        </div>
        <Button type="submit">Search</Button>
        {query && <Link href={webhookLogsHref(source)} className="px-3 py-2 text-sm underline">Clear</Link>}
      </form>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <WebhookSourceTabs source={source} query={query} />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-3 md:hidden">
            {records.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                {query ? "No webhooks match your search." : "No webhook logs yet."}
              </p>
            ) : (
              records.map((log) => (
                <WebhookLogCard
                  key={log.id}
                  log={log}
                  showSource={showSource}
                />
              ))
            )}
          </div>

          <div className="ring-foreground/10 hidden overflow-x-auto rounded-xl ring-1 md:block">
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
                {records.length === 0 ? (
                  <tr>
                    <td
                      className="text-muted-foreground px-5 py-8"
                      colSpan={showSource ? 4 : 3}
                    >
                      {query ? "No webhooks match your search." : "No webhook logs yet."}
                    </td>
                  </tr>
                ) : (
                  records.map((log) => (
                    <tr key={log.id} className="align-top">
                      <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                        {log.receivedAt}
                      </td>
                      {showSource ? (
                        <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                          {log.source}
                        </td>
                      ) : null}
                      <td className="border-border border-t px-5 py-3.5">
                        {log.payload ? (
                          <pre className="bg-muted/40 max-h-56 overflow-auto rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">
                            {log.payload}
                          </pre>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="border-border border-t px-5 py-3.5">
                        {log.headers ? (
                          <pre className="bg-muted/40 max-h-56 overflow-auto rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">
                            {log.headers}
                          </pre>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <WebhookPagination
            source={source}
            query={query}
            page={page}
            pageCount={pageCount}
            total={total}
          />
        </div>
      </div>
    </main>
  );
}
