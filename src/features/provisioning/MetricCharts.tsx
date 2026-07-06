import { Loading, EmptyState, ErrorState } from '@/components/states'
import { MetricChart } from '@/components/MetricChart'
import type { PolledData } from '@/lib/types'
import { usePolledData } from './useJobDetail'

function firstNumericValue(data: Record<string, unknown>): number | undefined {
  return Object.values(data).find((x) => typeof x === 'number') as number | undefined
}

function groupByMetricType(rows: PolledData[]): Map<string, [number, number][]> {
  const groups = new Map<string, [number, number][]>()
  for (const row of rows) {
    const value = firstNumericValue(row.data)
    if (value === undefined) continue
    const points = groups.get(row.metric_type) ?? []
    points.push([Date.parse(row.polled_at), value])
    groups.set(row.metric_type, points)
  }
  // The backend returns rows newest-first, but Highcharts datetime series
  // require ascending x values — sort each series' points by timestamp.
  for (const points of groups.values()) points.sort((a, b) => a[0] - b[0])
  return groups
}

export function MetricCharts({ jobId }: { jobId: number }) {
  const polled = usePolledData(jobId)

  if (polled.isLoading) return <Loading />
  if (polled.isError) return <ErrorState message={(polled.error as Error).message} onRetry={() => polled.refetch()} />
  if (!polled.data || polled.data.length === 0) return <EmptyState message="No polled data yet." />

  const groups = groupByMetricType(polled.data)

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([metricType, points]) => (
        <MetricChart key={metricType} title={metricType} series={[{ name: metricType, points }]} />
      ))}
    </div>
  )
}
