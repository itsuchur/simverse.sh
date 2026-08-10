import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Simverse",
  description: "Privacy Policy for the Simverse eSIM store.",
};

export default function PrivacyPolicy() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated: August 9, 2026
      </p>

      <section className="mt-6 space-y-4 text-sm leading-6">
        <p>
          This policy describes what data Simverse collects and how it is used
          when you use the app through Telegram.
        </p>
        <h2 className="text-lg font-medium">Data we collect</h2>
        <p>
          When you open the app, Telegram shares your public profile with us:
          your Telegram ID, display name, username, language, profile photo, and
          Premium status. We store this to create and maintain your account.
          When you purchase a package we store the order details (package,
          price, payment status) and the issued eSIM credentials so you can
          access them later.
        </p>
        <h2 className="text-lg font-medium">What we do not collect</h2>
        <p>
          We do not receive your phone number, contacts, or messages, and we do
          not sell personal data to third parties.
        </p>
        <h2 className="text-lg font-medium">Third parties</h2>
        <p>
          Order fulfillment requires sharing the purchased package details with
          our eSIM supplier. Payments are processed by external payment
          providers; we never see your card details. We use Sentry for error
          monitoring.
        </p>
        <h2 className="text-lg font-medium">Contact</h2>
        <p>
          To request deletion of your data or ask questions, contact support via
          the Telegram bot.
        </p>
      </section>
    </main>
  );
}
