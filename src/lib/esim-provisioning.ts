export type EsimProvisioningOs = "apple" | "android";

export function lpaCardData(
  smdpAddress: string | null,
  activationCode: string | null,
): string | null {
  const ac = activationCode?.trim();
  if (!ac) return null;

  if (/^LPA:1\$/i.test(ac)) {
    return ac;
  }

  if (ac.includes("$")) {
    const withoutLpa = ac.replace(/^LPA:/i, "");
    if (withoutLpa.startsWith("1$")) {
      return `LPA:${withoutLpa}`;
    }
    if (withoutLpa.startsWith("$")) {
      return `LPA:1${withoutLpa}`;
    }
    return `LPA:1$${withoutLpa}`;
  }

  const smdp = smdpAddress?.trim();
  if (!smdp) return null;
  return `LPA:1$${smdp}$${ac}`;
}

export function esimProvisioningUrl(
  os: EsimProvisioningOs,
  cardData: string,
): string {
  const host = os === "apple" ? "esimsetup.apple.com" : "esimsetup.android.com";
  return `https://${host}/esim_qrcode_provisioning?carddata=${encodeURIComponent(cardData)}`;
}
