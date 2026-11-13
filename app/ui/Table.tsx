import type { ReactNode } from "react";

/**
 * A data table that turns into a stack of cards on phones (see .table in globals.css).
 * The roles keep it a table for screen readers even while the cards are laid out as blocks.
 * Give every Td a label so the card can show what each value means.
 */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="table" role="table">
        <thead role="rowgroup">
          <tr role="row">
            {head.map((h, i) => (
              <th key={`${h}-${i}`} role="columnheader" scope="col">
                {h || <span className="sr">Actions</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr role="row">{children}</tr>;
}

export function Td({ label = "", className, colSpan, children }: { label?: string; className?: string; colSpan?: number; children?: ReactNode }) {
  return (
    <td role="cell" data-label={label} className={className} colSpan={colSpan}>
      {children}
    </td>
  );
}
