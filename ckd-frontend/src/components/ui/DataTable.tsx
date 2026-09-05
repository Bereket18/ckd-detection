import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { TABLE_CLASSES } from './styles';

export interface Column<Row> {
  /** Stable identity for the column. Also the React key. */
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Right-aligns and tabularises the figures so digits line up between rows. */
  numeric?: boolean;
  /** Screen-reader text when `header` is a glyph or is visually abbreviated. */
  headerLabel?: string;
}

interface DataTableProps<Row> {
  /**
   * Required. A table without a caption is announced as "table, 4 columns, 12
   * rows" and nothing else, which is useless when a page holds several (R7.6).
   */
  caption: ReactNode;
  /** Hides the caption visually while keeping it for assistive technology. */
  hideCaption?: boolean;
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row, index: number) => string;
  /** Shown in place of the body when `rows` is empty. */
  empty?: ReactNode;
  className?: string;
}

/**
 * A plain data table.
 *
 * Two accessibility details do the real work. The horizontal scroller is a
 * `role="region"` with `tabIndex={0}` and a name taken from the caption: below
 * roughly 640 px every metrics table overflows, and a scroll container that cannot
 * receive focus is unreachable by keyboard — the rows simply cannot be read. And
 * `<caption>` is required by the type rather than optional, because it is the only
 * thing that distinguishes one table from the next in a screen reader's table list.
 *
 * No sorting, no pagination, no virtualisation. The largest table this application
 * shows is a metrics block with fewer than twenty rows; the machinery would be
 * weight with no payload.
 */
export function DataTable<Row>({
  caption,
  hideCaption = false,
  columns,
  rows,
  rowKey,
  empty,
  className,
}: DataTableProps<Row>) {
  if (rows.length === 0 && empty !== undefined) {
    return <>{empty}</>;
  }

  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={typeof caption === 'string' ? caption : undefined}
      className={cn(TABLE_CLASSES.scroller, className)}
    >
      <table className={TABLE_CLASSES.table}>
        <caption className={cn(TABLE_CLASSES.caption, hideCaption && 'sr-only')}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(TABLE_CLASSES.th, column.numeric && 'text-right')}
              >
                {column.headerLabel === undefined ? (
                  column.header
                ) : (
                  <>
                    <span aria-hidden>{column.header}</span>
                    <span className="sr-only">{column.headerLabel}</span>
                  </>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(TABLE_CLASSES.td, column.numeric && TABLE_CLASSES.numeric)}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
