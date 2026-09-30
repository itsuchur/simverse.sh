/**
 * Best-effort English country name -> ISO 3166-1 alpha-2 resolver for
 * third-party eSIMfly packages, which only expose coverage as
 * `locationNetworkList[].locationName`.
 */

const ALIASES: Record<string, string> = {
  "united states of america": "US",
  usa: "US",
  uk: "GB",
  "united kingdom": "GB",
  "great britain": "GB",
  england: "GB",
  "czech republic": "CZ",
  turkiye: "TR",
  türkiye: "TR",
  russia: "RU",
  "south korea": "KR",
  korea: "KR",
  "north korea": "KP",
  vietnam: "VN",
  "viet nam": "VN",
  laos: "LA",
  macau: "MO",
  macao: "MO",
  "hong kong sar": "HK",
  "hong kong sar china": "HK",
  "macau sar": "MO",
  "macao sar china": "MO",
  taiwan: "TW",
  iran: "IR",
  syria: "SY",
  bolivia: "BO",
  venezuela: "VE",
  tanzania: "TZ",
  "ivory coast": "CI",
  "cote d'ivoire": "CI",
  "côte d'ivoire": "CI",
  "democratic republic of the congo": "CD",
  "dr congo": "CD",
  "congo-kinshasa": "CD",
  "republic of the congo": "CG",
  "congo-brazzaville": "CG",
  congo: "CG",
  eswatini: "SZ",
  swaziland: "SZ",
  myanmar: "MM",
  burma: "MM",
  "cape verde": "CV",
  "cabo verde": "CV",
  micronesia: "FM",
  moldova: "MD",
  brunei: "BN",
  palestine: "PS",
  "palestinian territories": "PS",
  vatican: "VA",
  "vatican city": "VA",
  "holy see": "VA",
  "u.s. virgin islands": "VI",
  "us virgin islands": "VI",
  "british virgin islands": "VG",
  reunion: "RE",
  curacao: "CW",
  "st. lucia": "LC",
  "saint lucia": "LC",
  "st. kitts and nevis": "KN",
  "saint kitts and nevis": "KN",
  "st. vincent and the grenadines": "VC",
  "saint vincent and the grenadines": "VC",
  "trinidad & tobago": "TT",
  "antigua & barbuda": "AG",
  "bosnia and herzegovina": "BA",
  "bosnia & herzegovina": "BA",
  "north macedonia": "MK",
  macedonia: "MK",
  "são tomé and príncipe": "ST",
  "sao tome and principe": "ST",
  "timor-leste": "TL",
  "east timor": "TL",
  "the netherlands": "NL",
  netherlands: "NL",
  holland: "NL",
  "the bahamas": "BS",
  "the gambia": "GM",
  "the philippines": "PH",
  "united arab emirates": "AE",
  uae: "AE",
  kyrgyzstan: "KG",
  "faroe islands": "FO",
  "falkland islands": "FK",
  guernsey: "GG",
  jersey: "JE",
  "isle of man": "IM",
  gibraltar: "GI",
  kosovo: "XK",
  "åland islands": "AX",
  "aland islands": "AX",
};

const ISO_COUNTRY_CODE = /^[A-Z]{2}$/;

/** Deprecated ISO codes ICU still resolves to a current country's name. */
const DEPRECATED_CODES = new Set([
  "AN",
  "BU",
  "CS",
  "DD",
  "FX",
  "NT",
  "QU",
  "SU",
  "TP",
  "UK",
  "YD",
  "YU",
  "ZR",
]);

function isCanonicalRegion(code: string) {
  if (DEPRECATED_CODES.has(code)) return false;
  try {
    return Intl.getCanonicalLocales(`und-${code}`)[0] === `und-${code}`;
  } catch {
    return false;
  }
}

function normalize(name: string) {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

let table: Map<string, string> | undefined;

function buildTable() {
  const map = new Map<string, string>();
  for (const [alias, code] of Object.entries(ALIASES)) {
    map.set(normalize(alias), code);
  }

  const display = new Intl.DisplayNames(["en"], { type: "region" });
  const A = "A".charCodeAt(0);
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i) + String.fromCharCode(A + j);
      if (!isCanonicalRegion(code)) continue;
      let name: string | undefined;
      try {
        name = display.of(code);
      } catch {
        continue;
      }
      // Intl echoes the code itself for regions it has no data for.
      if (!name || name === code) continue;
      const key = normalize(name);
      if (!map.has(key)) map.set(key, code);
      // "Hong Kong SAR China" -> "Hong Kong"
      const short = normalize(name.replace(/\s+SAR\b.*$/i, ""));
      if (short !== key && !map.has(short)) map.set(short, code);
    }
  }
  return map;
}

/** Returns the ISO alpha-2 code for an English country name, or undefined. */
export function countryNameToIso(name: string): string | undefined {
  const trimmed = name.trim();
  table ??= buildTable();
  const code = table.get(normalize(trimmed));
  if (code) return code;
  return ISO_COUNTRY_CODE.test(trimmed) && isCanonicalRegion(trimmed)
    ? trimmed
    : undefined;
}
