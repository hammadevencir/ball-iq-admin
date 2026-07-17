"use client";

/**
 * Compact preview of a parsed sheet's dynamic columns and a few sample rows.
 *
 * @param {{ columns: string[], data: Record<string, unknown>[], sampleRows?: number }} props
 */
export default function SheetPreview({ columns, data, sampleRows = 3 }) {
  if (!columns?.length) {
    return (
      <p className="mt-3 text-xs text-amber-400">
        No columns detected in this sheet.
      </p>
    );
  }

  const samples = data.slice(0, sampleRows);
  const format = (v) =>
    v === null || v === undefined || v === "" ? "—" : String(v);

  return (
    <div className="mt-3 space-y-2">
      {/* Detected columns */}
      <div className="flex flex-wrap gap-1.5">
        {columns.map((col) => (
          <span
            key={col}
            className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20"
          >
            {col}
          </span>
        ))}
      </div>

      {/* Sample rows */}
      {samples.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-white/5">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="text-left font-medium text-gray-400 px-2 py-1.5 whitespace-nowrap border-b border-white/10"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {samples.map((row, i) => (
                <tr key={i} className="odd:bg-white/[0.02]">
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="text-gray-300 px-2 py-1.5 whitespace-nowrap max-w-[160px] truncate"
                      title={format(row[col])}
                    >
                      {format(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.length > samples.length && (
        <p className="text-[11px] text-gray-500">
          + {data.length - samples.length} more row
          {data.length - samples.length > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
