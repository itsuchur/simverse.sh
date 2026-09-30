"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export type WebhookLogRecord = {
  id: string;
  receivedAt: string;
  source: string;
  payload: string | null;
  headers: string | null;
};

export function WebhookLogCard({
  log,
  showSource,
}: {
  log: WebhookLogRecord;
  showSource: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="ring-foreground/10 hover:bg-muted/40 w-full rounded-xl p-4 text-left ring-1 transition-colors"
        onClick={() => {
          setOpen(true);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="font-medium">
              {showSource ? log.source : "Webhook event"}
            </div>
            <div className="text-muted-foreground text-sm">{log.receivedAt}</div>
          </div>
          <div className="text-muted-foreground shrink-0 text-sm">View</div>
        </div>
        {log.payload ? (
          <pre className="text-muted-foreground mt-3 line-clamp-3 overflow-hidden font-mono text-xs whitespace-pre-wrap">
            {log.payload}
          </pre>
        ) : null}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4 data-open:zoom-in-100 data-closed:zoom-out-100 top-auto bottom-0 left-1/2 max-h-[min(90dvh,48rem)] w-full max-w-[calc(100%-0rem)] translate-x-[-50%] translate-y-0 gap-4 overflow-y-auto rounded-t-2xl rounded-b-none p-6 text-base sm:top-1/2 sm:bottom-auto sm:max-w-3xl sm:translate-y-[-50%] sm:rounded-xl sm:data-open:slide-in-from-bottom-0 sm:data-closed:slide-out-to-bottom-0 sm:data-open:zoom-in-95 sm:data-closed:zoom-out-95">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {showSource ? log.source : "Webhook"} · {log.receivedAt}
            </DialogTitle>
            <DialogDescription>
              Payload and headers for this webhook event.
            </DialogDescription>
          </DialogHeader>
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Payload</h3>
            {log.payload ? (
              <pre className="bg-muted/40 max-h-64 overflow-auto rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">
                {log.payload}
              </pre>
            ) : (
              <p className="text-muted-foreground text-sm">—</p>
            )}
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Headers</h3>
            {log.headers ? (
              <pre className="bg-muted/40 max-h-64 overflow-auto rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">
                {log.headers}
              </pre>
            ) : (
              <p className="text-muted-foreground text-sm">—</p>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
