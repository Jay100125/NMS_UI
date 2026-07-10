import type { ReactNode } from 'react'

// A KPI stat tile for a single headline number (counts, sizes, durations).
// Mirrors the Gauge card: value fills the body, label sits at the bottom.
export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border bg-card p-4 text-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="text-3xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </div>
      <span className="mt-2 text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
