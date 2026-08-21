"use client";

import { useState } from "react";

export type Column = { name: string; label: string; placeholder?: string; width?: string };

/**
 * A short repeating table — the entrance order, the speech list. Rows post as
 * parallel arrays (role[], names[]) and empty rows are dropped server-side, so
 * a couple can leave spare lines blank without creating junk.
 */
export default function RowEditor({
  columns,
  initial,
  addLabel,
  minRows = 3,
}: {
  columns: Column[];
  initial: Record<string, string>[];
  addLabel: string;
  minRows?: number;
}) {
  const blank = () => Object.fromEntries(columns.map((c) => [c.name, ""]));
  const seeded = initial.length ? initial : [];
  const [rows, setRows] = useState<Record<string, string>[]>(
    seeded.length >= minRows ? seeded : [...seeded, ...Array(minRows - seeded.length).fill(null).map(blank)],
  );

  return (
    <div>
      <div className="row-editor">
        {rows.map((row, index) => (
          <div className="row-editor-line" key={index}>
            <span className="row-editor-num">{index + 1}</span>
            {columns.map((col) => (
              <input
                key={col.name}
                type="text"
                name={`${col.name}[]`}
                defaultValue={row[col.name] ?? ""}
                placeholder={col.placeholder ?? col.label}
                aria-label={`${col.label}, row ${index + 1}`}
                style={col.width ? { flex: `0 0 ${col.width}` } : undefined}
              />
            ))}
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-sm" onClick={() => setRows([...rows, blank()])}>
        {addLabel}
      </button>
    </div>
  );
}
