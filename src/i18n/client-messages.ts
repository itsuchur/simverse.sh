import type { AbstractIntlMessages } from "next-intl";

/** Client namespaces needed outside `/app` (home picker + help back button). */
export const MARKETING_CLIENT_NAMESPACES = [
  "LocaleSwitcher",
  "Profile",
] as const;

type MarketingClientNamespace = (typeof MARKETING_CLIENT_NAMESPACES)[number];

export function pickMessages(
  messages: AbstractIntlMessages,
  namespaces: readonly MarketingClientNamespace[],
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
