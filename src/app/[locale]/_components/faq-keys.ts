export const FAQ_KEYS = [
  "whatIsEsim",
  "deviceSupport",
  "fees",
  "callsAndSms",
] as const;

export type FaqKey = (typeof FAQ_KEYS)[number];
