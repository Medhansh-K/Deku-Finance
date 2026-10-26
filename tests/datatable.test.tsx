import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable, ColumnDef } from '@/components/data-table/DataTable';

interface TestRow {
  id: string;
  code: string;
  name: string;
  balance: number;
}

const mockData: TestRow[] = [
  { id: '1', code: '1001', name: 'Cash on Hand', balance: 50000 },
  { id: '2', code: '1002', name: 'HDFC Bank Account', balance: 250000 },
  { id: '3', code: '2001', name: 'Sundry Creditors', balance: 120000 },
];

const mockColumns: ColumnDef<TestRow>[] = [
  {
    header: 'Account Code',
    cell: (row) => row.code,
    sortKey: (row) => row.code,
    sortable: true,
  },
  {
    header: 'Account Name',
    cell: (row) => row.name,
    sortKey: (row) => row.name,
    sortable: true,
  },
  {
    header: 'Balance',
    cell: (row) => `₹${row.balance}`,
    sortKey: (row) => row.balance,
    sortable: true,
    align: 'right',
  },
];

describe('DataTable Component', () => {
  it('renders table headers and rows correctly', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    expect(screen.getByText('Account Code')).toBeInTheDocument();
    expect(screen.getByText('Account Name')).toBeInTheDocument();
    expect(screen.getByText('Cash on Hand')).toBeInTheDocument();
    expect(screen.getByText('HDFC Bank Account')).toBeInTheDocument();
    expect(screen.getByText('Sundry Creditors')).toBeInTheDocument();
  });

  it('filters data dynamically using the search bar', () => {
    render(<DataTable columns={mockColumns} data={mockData} searchPlaceholder="Search ledgers..." />);

    const searchInput = screen.getByPlaceholderText('Search ledgers...');
    fireEvent.change(searchInput, { target: { value: 'HDFC' } });

    expect(screen.getByText('HDFC Bank Account')).toBeInTheDocument();
    expect(screen.queryByText('Cash on Hand')).not.toBeInTheDocument();
    expect(screen.queryByText('Sundry Creditors')).not.toBeInTheDocument();
  });

  it('renders custom empty message when no rows match', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        emptyMessage="No ledger accounts match this filter."
      />
    );

    const searchInput = screen.getByPlaceholderText('Search records...');
    fireEvent.change(searchInput, { target: { value: 'NonExistent' } });

    expect(screen.getByText('No ledger accounts match this filter.')).toBeInTheDocument();
  });

  it('calls onRowClick callback when a row is clicked', () => {
    const handleRowClick = vi.fn();
    render(<DataTable columns={mockColumns} data={mockData} onRowClick={handleRowClick} />);

    const row = screen.getByText('HDFC Bank Account');
    fireEvent.click(row);

    expect(handleRowClick).toHaveBeenCalledTimes(1);
    expect(handleRowClick).toHaveBeenCalledWith(mockData[1]);
  });
});
