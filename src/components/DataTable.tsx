import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export interface Column<T> { header: string; cell: (row: T) => React.ReactNode }

export function DataTable<T>({ columns, rows, rowKey }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string | number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>{columns.map((c, i) => <TableHead key={i}>{c.header}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={rowKey(row)}>{columns.map((c, i) => <TableCell key={i}>{c.cell(row)}</TableCell>)}</TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
