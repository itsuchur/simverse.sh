import { db } from "~/server/db";

export const dynamic = "force-dynamic";

const WEBHOOK_LIMIT = 200;

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

export default async function DashboardWebhooksPage() {
  const logs = await db.webhookLog.findMany({
    take: WEBHOOK_LIMIT,
    orderBy: { receivedAt: "desc" },
  });

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Webhooks</h1>
      <div className="ring-foreground/10 overflow-x-auto rounded-xl ring-1">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left text-base">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="w-44 px-5 py-3.5 font-medium">Received</th>
              <th className="w-36 px-5 py-3.5 font-medium">Source</th>
              <th className="px-5 py-3.5 font-medium">Payload</th>
              <th className="px-5 py-3.5 font-medium">Headers</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td className="text-muted-foreground px-5 py-8" colSpan={4}>
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
                    <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                      {log.source}
                    </td>
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
    </main>
  );
}
