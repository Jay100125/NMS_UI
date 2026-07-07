import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import type { PolledData } from '@/lib/types'
import { usePolledData } from './useJobDetail'

const PAGE_SIZE = 25

function formatValues(data: Record<string, unknown>): string {
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? v : JSON.stringify(v)}`)
    .join(', ')
}

/** Raw polled samples, newest first (backend order), paginated client-side. */
export function PolledDataGrid({ jobId }: { jobId: number }) {
  const polled = usePolledData(jobId)
  const [page, setPage] = useState(0)

  if (polled.isLoading) return <Loading />
  if (polled.isError) return <ErrorState message={(polled.error as Error).message} onRetry={() => polled.refetch()} />
  if (!polled.data || polled.data.length === 0) return <EmptyState message="No polled data yet." />

  const pageCount = Math.ceil(polled.data.length / PAGE_SIZE)
  const safePage = Math.min(page, pageCount - 1)
  const rows = polled.data.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const columns: Column<PolledData>[] = [
    { header: 'Timestamp', cell: (r) => new Date(r.polled_at).toLocaleString() },
    { header: 'Metric', cell: (r) => r.metric_type },
    { header: 'Values', cell: (r) => <span className="font-mono text-xs">{formatValues(r.data)}</span> },
  ]

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">Raw polled data</h2>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
      {pageCount > 1 && (
        <div className="mt-2 flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {safePage + 1} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
