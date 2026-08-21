/**
 * A table cell that also works as a labelled row once the table stacks into
 * cards on narrow screens. Keeping the contents in one wrapper matters: the
 * stacked layout puts the label and the value side by side, so a cell with a
 * loose value plus a sub-line would otherwise split into competing columns.
 */
export default function Cell({
  label,
  className,
  nowrap,
  children,
}: {
  label: string;
  className?: string;
  nowrap?: boolean;
  children: React.ReactNode;
}) {
  return (
    <td data-label={label} style={nowrap ? { whiteSpace: "nowrap" } : undefined}>
      <div className={`cell-value${className ? ` ${className}` : ""}`}>{children}</div>
    </td>
  );
}
