import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable, type Column } from './DataTable';
import { EmptyState } from './EmptyState';

interface Metric {
  name: string;
  value: number;
}

const COLUMNS: readonly Column<Metric>[] = [
  { key: 'name', header: 'Metric', cell: (row) => row.name },
  { key: 'value', header: 'Value', cell: (row) => row.value.toFixed(3), numeric: true },
];

const ROWS: readonly Metric[] = [
  { name: 'Accuracy', value: 0.975 },
  { name: 'AUC-ROC', value: 0.998 },
];

/**
 * The table's accessibility rests on two things that are easy to omit and hard to
 * notice missing: a caption, and a focusable scroll container.
 *
 * Below roughly 640 px every metrics table overflows horizontally. A scroll
 * container that cannot take focus is unreachable by keyboard, which means the rows
 * to the right of the fold simply cannot be read — the failure is total, and it is
 * invisible on a desktop screen.
 */
describe('DataTable', () => {
  it('names itself, so one table is distinguishable from the next', () => {
    render(
      <DataTable caption="Model metrics" columns={COLUMNS} rows={ROWS} rowKey={(row) => row.name} />
    );
    expect(screen.getByRole('table', { name: 'Model metrics' })).toBeVisible();
  });

  it('puts the horizontal scroller in the tab order', () => {
    render(
      <DataTable caption="Model metrics" columns={COLUMNS} rows={ROWS} rowKey={(row) => row.name} />
    );
    const region = screen.getByRole('region', { name: 'Model metrics' });
    expect(region).toHaveAttribute('tabindex', '0');

    region.focus();
    expect(region).toHaveFocus();
  });

  it('keeps the caption for assistive technology when it is visually hidden', () => {
    render(
      <DataTable
        caption="Model metrics"
        hideCaption
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.name}
      />
    );
    // Hidden visually, still the table's name.
    expect(screen.getByRole('table', { name: 'Model metrics' })).toBeVisible();
  });

  it('marks header cells as column headers', () => {
    render(
      <DataTable caption="Model metrics" columns={COLUMNS} rows={ROWS} rowKey={(row) => row.name} />
    );
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    for (const header of headers) expect(header).toHaveAttribute('scope', 'col');
  });

  it('renders every row and every cell it was given', () => {
    render(
      <DataTable caption="Model metrics" columns={COLUMNS} rows={ROWS} rowKey={(row) => row.name} />
    );
    // Header row plus one row per datum.
    expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1);
    expect(screen.getByRole('cell', { name: '0.975' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'AUC-ROC' })).toBeVisible();
  });

  it('gives an abbreviated header a spoken form without duplicating it visually', () => {
    render(
      <DataTable
        caption="Drivers"
        columns={[
          { key: 'f', header: 'Feature', cell: (row: Metric) => row.name },
          { key: 'v', header: '±', headerLabel: 'Direction of effect', cell: () => '+' },
        ]}
        rows={ROWS}
        rowKey={(row) => row.name}
      />
    );
    const header = screen.getByRole('columnheader', { name: 'Direction of effect' });
    // The glyph is hidden from the name so the name is not "± Direction of effect".
    expect(header.querySelector('[aria-hidden="true"]')).toHaveTextContent('±');
  });

  it('shows the empty case instead of an empty grid', () => {
    render(
      <DataTable
        caption="Model metrics"
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.name}
        empty={<EmptyState title="No metrics available" />}
      />
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('No metrics available')).toBeVisible();
  });

  it('still renders a table when no empty slot was provided', () => {
    // A caller that omits `empty` gets headers with no body, which is honest: the
    // columns exist, there is simply nothing in them.
    render(<DataTable caption="Model metrics" columns={COLUMNS} rows={[]} rowKey={() => 'k'} />);
    expect(screen.getByRole('table', { name: 'Model metrics' })).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });
});
