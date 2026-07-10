import type { PolledData } from '@/lib/types'
import type { ChartSeries } from '@/components/MetricChart'
import { formatBytes, formatBytesPerSec } from '@/lib/format'

export const prettyKey = (k: string) => k.replace(/^system_/, '').replace(/_/g, ' ')

export interface InstanceRow { instance: string; data: Record<string, unknown> }

/** The most recent host-level (instance IS NULL) sample for a category. */
export function latestHost(rows: PolledData[], type: string): Record<string, unknown> {
  let latest: PolledData | undefined
  for (const r of rows) {
    if (r.instance == null && r.metric_type === type && (!latest || r.polled_at > latest.polled_at)) latest = r
  }
  return latest?.data ?? {}
}

export function num(data: Record<string, unknown>, key: string): number | null {
  const v = data[key]
  return typeof v === 'number' ? v : null
}

/** Time-ordered series for the given host counter keys of a category. */
export function seriesFor(rows: PolledData[], type: string, keys: string[]): ChartSeries[] {
  const rs = rows.filter((r) => r.instance == null && r.metric_type === type)
  return keys
    .map((k) => ({
      name: prettyKey(k),
      points: rs
        .map((r) => [Date.parse(r.polled_at), Number(r.data[k])] as [number, number])
        .filter((p) => Number.isFinite(p[1]))
        .sort((a, b) => a[0] - b[0]),
    }))
    .filter((s) => s.points.length > 0)
}

/** The most recent sample per instance for a category. */
export function latestInstances(rows: PolledData[], type: string): InstanceRow[] {
  const byInstance = new Map<string, PolledData>()
  for (const r of rows) {
    if (r.instance == null || r.metric_type !== type) continue
    const cur = byInstance.get(r.instance)
    if (!cur || r.polled_at > cur.polled_at) byInstance.set(r.instance, r)
  }
  return [...byInstance.values()].map((r) => ({ instance: r.instance as string, data: r.data }))
}

/** Format a counter value by its key suffix: percent, bytes, byte-rate, or plain count. */
export function formatCounter(key: string, v: unknown): string {
  if (typeof v !== 'number') return String(v ?? '')
  if (key.endsWith('_percent')) return `${v.toFixed(1)}%`
  if (key.endsWith('_bytes_per_sec')) return formatBytesPerSec(v)
  if (key.endsWith('_bytes')) return formatBytes(v)
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2)
}
