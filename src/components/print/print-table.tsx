"use client";

import React from "react";

interface PrintTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

interface PrintTableProps<T> {
  columns: PrintTableColumn<T>[];
  data: T[];
  /** Optional caption above the table */
  caption?: string;
}

/**
 * Simple table for print context. Clean borders, minimal styling.
 */
export function PrintTable<T extends Record<string, unknown>>({
  columns,
  data,
  caption,
}: PrintTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto">
      {caption && (
        <p className="text-sm font-medium text-gray-700 mb-2">{caption}</p>
      )}
      <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-2 py-2 text-left text-sm font-semibold bg-gray-100 border-b border-gray-200 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-b border-gray-100 last:border-0">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2 py-2 text-sm text-gray-900 border-gray-100 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.className ?? ""}`}
                >
                  {col.render
                    ? col.render(row)
                    : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
