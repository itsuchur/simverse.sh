import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Simverse",
  description: "Terms of Service for the Simverse eSIM store.",
};

export default function TermsOfService() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated: August 9, 2026
      </p>

      <section className="mt-6 space-y-4 text-sm leading-6">
        <p>
          These Terms of Service govern your use of Simverse, a store for travel
          eSIM data packages available through Telegram. By using the service
          you agree to these terms.
        </p>
        <h2 className="text-lg font-medium">Service</h2>
        <p>
          Simverse resells prepaid eSIM data packages provided by third-party
          network suppliers. Package availability, coverage, speed, and validity
          are determined by the supplier and are described on each package
          before purchase.
        </p>
        <h2 className="text-lg font-medium">Payments</h2>
        <p>
          Prices are shown before checkout. A purchase is complete when the
          payment provider confirms the transaction, after which the eSIM is
          provisioned and delivered inside the app.
        </p>
        <h2 className="text-lg font-medium">Acceptable use</h2>
        <p>
          You may not resell packages, use the service for unlawful activity, or
          attempt to disrupt or gain unauthorized access to the service.
        </p>
        <h2 className="text-lg font-medium">Contact</h2>
        <p>
          Questions about these terms can be sent to support via the Telegram
          bot.
        </p>
      </section>
    </main>
  );
}
