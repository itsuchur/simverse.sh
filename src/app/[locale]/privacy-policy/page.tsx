import type { Metadata } from "next";

import { LegalPage, legalMetadata } from "../_components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("PrivacyPolicy");
}

export default function PrivacyPolicy() {
  return <LegalPage namespace="PrivacyPolicy" document="privacy" />;
}
