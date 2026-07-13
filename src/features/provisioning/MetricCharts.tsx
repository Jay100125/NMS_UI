import { Loading, EmptyState, ErrorState } from '@/components/states'
import { MetricChart, type ChartSeries } from '@/components/MetricChart'
import type { PolledData } from '@/lib/types'
import { usePolledData } from './useJobDetail'

type Unit = 'percent' | 'bytes_per_sec' | 'bytes' | 'other'

const unitOf = (key: string): Unit =>
  key.endsWith('_percent') ? 'percent'
    : key.endsWith('_bytes_per_sec') ? 'bytes_per_sec'
      : key.endsWith('_bytes') ? 'bytes'
        : 'other'

const UNIT_LABEL: Record<Unit, string> = { percent: '%', bytes_per_sec: 'bytes/sec', bytes: 'bytes', other: '' }

const prettyKey = (k: string) => k.replace(/^system_/, '').replace(/_/g, ' ')

interface Chart { title: string; series: ChartSeries[] }

// Build one multi-series chart per (metric category × unit family) from host rows
// (instance == null). Grouping by unit keeps same-scale counters on one axis.
function buildCharts(rows: PolledData[]): Chart[] {
  const host = rows.filter((r) => r.instance == null)

  const byType = new Map<string, PolledData[]>()
  for (const r of host) {
    const arr = byType.get(r.metric_type) ?? []
    arr.push(r)
    byType.set(r.metric_type, arr)
  }

  const charts: Chart[] = []
  for (const [type, rs] of byType) {
    const keysByUnit = new Map<Unit, Set<string>>()
    for (const r of rs) {
      for (const [k, v] of Object.entries(r.data)) {
        if (typeof v === 'number') {
          const u = unitOf(k)
          const set = keysByUnit.get(u) ?? new Set<string>()
          set.add(k)
          keysByUnit.set(u, set)
        }
      }
    }

    for (const [unit, keys] of keysByUnit) {
      const series: ChartSeries[] = [...keys].sort().map((k) => ({
        name: prettyKey(k),
        points: rs
          .map((r) => [Date.parse(r.polled_at), Number(r.data[k])] as [number, number])
          .filter((p) => Number.isFinite(p[1]))
          .sort((a, b) => a[0] - b[0]),
      })).filter((s) => s.points.length > 0)

      if (series.length) {
        const label = UNIT_LABEL[unit]
        charts.push({ title: label ? `${type} · ${label}` : type, series })
      }
    }
  }
  return charts
}

export function MetricCharts({ jobId }: { jobId: number }) {
  const polled = usePolledData(jobId)

  if (polled.isLoading) return <Loading />
  if (polled.isError) return <ErrorState message={(polled.error as Error).message} onRetry={() => polled.refetch()} />
  if (!polled.data || polled.data.length === 0) return <EmptyState message="No polled data yet." />

  const charts = buildCharts(polled.data)
  if (charts.length === 0) return <EmptyState message="No chartable metrics yet." />

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {charts.map((c) => (
        <div key={c.title} className="rounded-lg border bg-card p-3">
          <MetricChart title={c.title} series={c.series} />
        </div>
      ))}
    </div>
  )
}
