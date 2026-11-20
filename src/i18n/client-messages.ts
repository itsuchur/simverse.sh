import type { AbstractIntlMessages } from "next-intl";

/** Client namespaces needed outside `/app` (home picker + help back button). */
export const MARKETING_CLIENT_NAMESPACES = [
  "LocaleSwitcher",
  "Profile",
] as const;

/** Extra client namespaces for the website store: catalog, checkout, account. */
export const STORE_CLIENT_NAMESPACES = [
  ...MARKETING_CLIENT_NAMESPACES,
  "Auth",
  "Catalog",
  "Checkout",
  "MyEsims",
  "EsimStatus",
  "Store",
] as const;

export function pickMessages(
  messages: AbstractIntlMessages,
  namespaces: readonly string[],
): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {};
  for (const namespace of namespaces) {
    const value = messages[namespace];
    if (value !== undefined) {
      picked[namespace] = value;
    }
  }
  return picked;
}
