import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy — Simverse",
  description: "Refund Policy for the Simverse eSIM store.",
};

export default function RefundPolicy() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Refund Policy</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated: August 9, 2026
      </p>

      <section className="mt-6 space-y-4 text-sm leading-6">
        <p>
          eSIM data packages are digital goods delivered immediately after
          purchase, so refunds are limited to the cases below.
        </p>
        <h2 className="text-lg font-medium">Eligible for a refund</h2>
        <p>
          A full refund is available if the eSIM could not be provisioned, or if
          the eSIM was never installed and never activated and you request the
          refund within 30 days of purchase.
        </p>
        <h2 className="text-lg font-medium">Not eligible</h2>
        <p>
          Packages that have been installed on a device, activated, partially
          used, or have expired are not refundable. Connectivity issues caused
          by device incompatibility or local network conditions outside the
          advertised coverage are not grounds for a refund.
        </p>
        <h2 className="text-lg font-medium">How to request</h2>
        <p>
          Contact support via the Telegram bot with your order number. Approved
          refunds are returned to the original payment method.
        </p>
      </section>
    </main>
  );
}
