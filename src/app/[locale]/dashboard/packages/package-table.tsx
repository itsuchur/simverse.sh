import { PackageExclusionButton } from "./package-exclusion-button";
import type { PackageProvider } from "./provider-tabs";

/** Provider-agnostic row: common fields plus provider-specific columns. */
export type PackageRow = {
  packageCode: string;
  name: string;
  nameRu?: string;
  location: string;
  data: string;
  duration: string;
  /** Values for `extraColumns`, in the same order. */
  extra: string[];
};

const LOCATION_PREVIEW = 6;

function formatLocation(location: string) {
  const codes = location.split(",").filter(Boolean);
  if (codes.length === 0) {
    return "—";
  }
  if (codes.length <= LOCATION_PREVIEW) {
    return codes.join(", ");
  }
  return `${codes.slice(0, LOCATION_PREVIEW).join(", ")} +${codes.length - LOCATION_PREVIEW}`;
}

function PackageMobileCard({
  provider,
  row,
  extraColumns,
}: {
  provider: PackageProvider;
  row: PackageRow;
  extraColumns: string[];
}) {
  return (
    <div className="ring-foreground/10 space-y-3 rounded-xl p-4 ring-1">
      <div className="space-y-1">
        <div className="font-medium">{row.name}</div>
        {row.nameRu ? (
          <div className="text-muted-foreground text-sm">{row.nameRu}</div>
        ) : null}
        <div className="font-mono text-sm">{row.packageCode}</div>
      </div>
      <div className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <div className="text-foreground font-medium">Data</div>
          {row.data}
        </div>
        <div>
          <div className="text-foreground font-medium">Duration</div>
          {row.duration}
        </div>
        {extraColumns.map((label, i) => (
          <div key={label}>
            <div className="text-foreground font-medium">{label}</div>
            {row.extra[i] ?? "—"}
          </div>
        ))}
      </div>
      <div className="text-muted-foreground font-mono text-xs break-all">
        {formatLocation(row.location)}
      </div>
      <PackageExclusionButton
        provider={provider}
        packageCode={row.packageCode}
      />
    </div>
  );
}

export function PackageTable({
  provider,
  rows,
  extraColumns,
  emptyMessage,
}: {
  provider: PackageProvider;
  rows: PackageRow[];
  extraColumns: string[];
  emptyMessage: string;
}) {
  const columnCount = 6 + extraColumns.length;

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            {emptyMessage}
          </p>
        ) : (
          rows.map((row) => (
            <PackageMobileCard
              key={row.packageCode}
              provider={provider}
              row={row}
              extraColumns={extraColumns}
            />
          ))
        )}
      </div>

      <div className="ring-foreground/10 hidden overflow-x-auto rounded-xl ring-1 md:block">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-base">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-5 py-3.5 font-medium">Code</th>
              <th className="px-5 py-3.5 font-medium">Name</th>
              <th className="px-5 py-3.5 font-medium">Location</th>
              <th className="px-5 py-3.5 font-medium">Data</th>
              <th className="px-5 py-3.5 font-medium">Duration</th>
              {extraColumns.map((label) => (
                <th key={label} className="px-5 py-3.5 font-medium">
                  {label}
                </th>
              ))}
              <th className="px-5 py-3.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="text-muted-foreground px-5 py-8"
                  colSpan={columnCount}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.packageCode} className="align-top">
                  <td className="border-border border-t px-5 py-3.5 font-mono text-sm whitespace-nowrap">
                    {row.packageCode}
                  </td>
                  <td className="border-border min-w-48 border-t px-5 py-3.5">
                    <div>{row.name}</div>
                    {row.nameRu ? (
                      <div className="text-muted-foreground text-sm">
                        {row.nameRu}
                      </div>
                    ) : null}
                  </td>
                  <td className="border-border max-w-72 border-t px-5 py-3.5 font-mono text-sm">
                    {formatLocation(row.location)}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {row.data}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {row.duration}
                  </td>
                  {extraColumns.map((label, i) => (
                    <td
                      key={label}
                      className="border-border border-t px-5 py-3.5 whitespace-nowrap"
                    >
                      {row.extra[i] ?? "—"}
                    </td>
                  ))}
                  <td className="border-border border-t px-5 py-3.5">
                    <PackageExclusionButton
                      provider={provider}
                      packageCode={row.packageCode}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
