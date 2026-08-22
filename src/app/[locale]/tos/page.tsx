import type { Metadata } from "next";

import { LegalPage, legalMetadata } from "../_components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("Tos");
}

export default function TermsOfService() {
  return <LegalPage namespace="Tos" document="tos" />;
}
