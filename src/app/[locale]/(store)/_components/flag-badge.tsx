import ReactCountryFlag from "react-country-flag";

/** Country flag as a rounded 4:3 badge with a hairline ring. */
export function FlagBadge({
  countryCode,
  height,
}: {
  countryCode: string;
  /** CSS height; the width follows the 4:3 flag ratio. */
  height: string;
}) {
  return (
    <ReactCountryFlag
      countryCode={countryCode}
      svg
      aria-hidden
      style={{
        height,
        width: `calc(${height} * 4 / 3)`,
        flexShrink: 0,
        objectFit: "cover",
        borderRadius: "0.375rem",
        boxShadow:
          "0 0 0 1px rgb(0 0 0 / 0.08), 0 1px 3px rgb(0 0 0 / 0.12)",
      }}
    />
  );
}
