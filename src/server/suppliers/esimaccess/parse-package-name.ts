/**
 * Supplier names follow `<label> <volume><per-day?> <days?> <FUP?> <modifier?>`,
 * e.g. "Spain 3GB 30Days", "Singapore 2GB/Day", "Japan 3GB/Day FUP1Mbps (IIJ)".
 */
const NAME_PATTERN =
  /^(?<label>.+?)\s+(?<amount>\d+(?:\.\d+)?)(?<unit>MB|GB)(?<perDay>\/Day|\s+Daily)?(?:\s+(?<days>\d+)\s*[Dd]ays?)?(?<rest>.*)$/;

export type ParsedName = {
  label: string;
  amount: string;
  unit: "MB" | "GB";
  perDay: boolean;
  days?: number;
  fup?: { value: number; unit: "K" | "M" };
  modifier?: string;
};

export function parseName(name: string): ParsedName | null {
  const match = NAME_PATTERN.exec(name.trim());
  if (!match?.groups) return null;

  const { label, amount, unit, perDay, days, rest } = match.groups as {
    label: string;
    amount: string;
    unit: "MB" | "GB";
    perDay?: string;
    days?: string;
    rest?: string;
  };

  let fup: ParsedName["fup"];
  let modifier: string | undefined;
  if (rest) {
    const fupMatch = /FUP(\d+)([KM])bps/.exec(rest);
    if (fupMatch) {
      fup = { value: Number(fupMatch[1]), unit: fupMatch[2] as "K" | "M" };
    }
    const leftover = rest.replace(/FUP\d+[KM]bps/, "").trim();
    if (leftover) modifier = leftover;
  }

  return {
    label: label.trim(),
    amount,
    unit,
    perDay: Boolean(perDay),
    days: days ? Number(days) : undefined,
    fup,
    modifier,
  };
}
