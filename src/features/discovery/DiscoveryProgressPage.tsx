import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/DataTable'
import { MessageCell } from '@/components/MessageCell'
import { EmptyState } from '@/components/states'
import { useDiscoveryProgress } from './useDiscoveryProgress'
import type { ProgressRow } from './progress'

function StageChip({ row }: { row: ProgressRow }) {
  if (!row.stage) return <span className="text-sm text-muted-foreground">queued</span>
  const variant = row.status === 'failed' ? 'destructive' : row.status === 'completed' ? 'success' : 'secondary'
  return <Badge variant={variant}>{row.stage}</Badge>
}

function RowBar({ value, failed }: { value: number; failed: boolean }) {
  return (
    <div className="h-2 w-28 rounded bg-muted">
      <div
        className={`h-2 rounded ${failed ? 'bg-red-500' : 'bg-primary'}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  )
}

export function DiscoveryProgressPage() {
  const { id } = useParams<{ id: string }>()
  const discoveryId = Number(id)
  const navigate = useNavigate()
  const { state, summary, live } = useDiscoveryProgress(discoveryId)

  useEffect(() => {
    if (state.runState === 'COMPLETED') navigate(`/discovery/${discoveryId}/result`, { replace: true })
  }, [state.runState, discoveryId, navigate])

  const rows = Object.values(state.rows)

  const columns: Column<ProgressRow>[] = [
    { header: 'IP', cell: (r) => r.ip },
    { header: 'Stage', cell: (r) => <StageChip row={r} /> },
    { header: 'Progress', cell: (r) => <RowBar value={r.progress} failed={r.status === 'failed'} /> },
    { header: '%', cell: (r) => `${Math.round(r.progress)}%` },
    { header: 'Message', cell: (r) => <MessageCell message={r.message} ok={r.status === 'completed'} /> },
  ]

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Discovery progress</h1>
        {live
          ? <Badge variant="secondary">Live</Badge>
          : <Badge variant="outline">live updates unavailable — falling back to polling</Badge>}
      </div>

      {state.runState === 'FAILED' && (
        <p className="mb-4 text-sm text-red-600">Run failed{state.runMessage ? `: ${state.runMessage}` : ''}</p>
      )}

      <div className="mb-2 h-3 w-full rounded bg-muted">
        <div className="h-3 rounded bg-primary transition-all" style={{ width: `${summary.overallPct}%` }} />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{summary.overallPct}%</p>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold" data-testid="tile-total">{summary.total}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Discovered</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-green-600" data-testid="tile-discovered">{summary.discovered}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Failed</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-red-600" data-testid="tile-failed">{summary.failed}</CardContent></Card>
      </div>

      {rows.length === 0
        ? <EmptyState message="Waiting for targets…" />
        : <DataTable columns={columns} rows={rows} rowKey={(r) => r.ip} />}
    </div>
  )
}
