import type { ReactNode } from 'react'

// KPI tile: label at the top, headline value pinned to the bottom.
export function StatTile({ label, value, sub, accent }: {
  label: string
  value: ReactNode
  sub?: string
  accent?: string
}) {
  return (
    <div className="flex min-h-[104px] flex-col justify-between rounded-lg border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div>
        <div className="text-3xl font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  )
}

/** Utilization color: teal → orange → red. */
export function pctAccent(v: number | null | undefined): string | undefined {
  if (typeof v !== 'number') return undefined
  return v >= 90 ? '#EF4444' : v >= 75 ? '#F97316' : '#0D9488'
}
