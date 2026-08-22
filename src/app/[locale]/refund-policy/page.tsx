import type { Metadata } from "next";

import { LegalPage, legalMetadata } from "../_components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("RefundPolicy");
}

export default function RefundPolicy() {
  return <LegalPage namespace="RefundPolicy" document="refunds" />;
}
