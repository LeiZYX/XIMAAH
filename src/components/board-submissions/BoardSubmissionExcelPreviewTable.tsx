"use client";

export function BoardSubmissionExcelPreviewTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: readonly string[];
  rows: (string | number)[][];
}) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">Same column layout as the downloaded Excel file.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-100">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700"
                >
                  {header || " "}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="even:bg-slate-50/60">
                {headers.map((_, cellIndex) => (
                  <td key={cellIndex} className="whitespace-nowrap px-3 py-2 text-slate-800">
                    {formatPreviewCell(row[cellIndex])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatPreviewCell(value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}
