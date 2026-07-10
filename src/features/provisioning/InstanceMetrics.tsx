import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState } from '@/components/states'
import type { PolledData } from '@/lib/types'
import { usePolledData } from './useJobDetail'

const prettyKey = (k: string) => k.replace(/^system_/, '').replace(/_/g, ' ')

const fmt = (v: unknown) => {
  if (typeof v !== 'number') return String(v ?? '')
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2)
}

interface InstanceRow { instance: string; data: Record<string, unknown> }

// The most recent sample per instance for one category.
function latestInstances(rows: PolledData[], type: string): InstanceRow[] {
  const byInstance = new Map<string, PolledData>()
  for (const r of rows) {
    if (r.instance == null || r.metric_type !== type) continue
    const cur = byInstance.get(r.instance)
    if (!cur || r.polled_at > cur.polled_at) byInstance.set(r.instance, r)
  }
  return [...byInstance.values()].map((r) => ({ instance: r.instance as string, data: r.data }))
}

export function InstanceMetrics({ jobId }: { jobId: number }) {
  const polled = usePolledData(jobId)

  if (polled.isLoading) return <Loading />
  if (polled.isError) return <ErrorState message={(polled.error as Error).message} onRetry={() => polled.refetch()} />

  const rows = polled.data ?? []
  const types = [...new Set(rows.filter((r) => r.instance != null).map((r) => r.metric_type))].sort()
  if (types.length === 0) return null // nothing instance-scoped to show

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-medium text-muted-foreground">Instances</h2>
      {types.map((type) => {
        const instances = latestInstances(rows, type)
        if (instances.length === 0) return null
        const keys = [...new Set(instances.flatMap((i) => Object.keys(i.data)))].filter((k) => k !== 'instance')
        const columns: Column<InstanceRow>[] = [
          { header: 'Instance', cell: (r) => <span className="font-medium">{r.instance}</span> },
          ...keys.map((k): Column<InstanceRow> => ({ header: prettyKey(k), cell: (r) => fmt(r.data[k]) })),
        ]
        return (
          <div key={type}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{type}</h3>
            <div className="overflow-x-auto rounded-lg border">
              <DataTable columns={columns} rows={instances} rowKey={(r) => r.instance} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
