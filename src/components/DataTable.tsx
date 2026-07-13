import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export interface Column<T> { header: string; cell: (row: T) => React.ReactNode; className?: string }

export function DataTable<T>({ columns, rows, rowKey, onRowClick }: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>{columns.map((c, i) => <TableHead key={i} className={c.className}>{c.header}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={onRowClick ? 'cursor-pointer' : undefined}
          >
            {columns.map((c, i) => <TableCell key={i} className={c.className}>{c.cell(row)}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
