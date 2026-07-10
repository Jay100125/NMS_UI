// Radial percentage gauge (0–100). Teal by default, warns orange/red at high utilization.
export function Gauge({ label, value }: { label: string; value: number | null | undefined }) {
  const has = typeof value === 'number' && Number.isFinite(value)
  const pct = has ? Math.max(0, Math.min(100, value as number)) : 0
  const r = 42
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  const color = !has ? '#9ca3af' : pct >= 90 ? '#EF4444' : pct >= 75 ? '#F97316' : '#0D9488'

  return (
    <div className="flex flex-col items-center rounded-lg border bg-card p-4">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
          <circle
            cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            style={{ transition: 'stroke-dasharray 300ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums">
          {has ? `${Math.round(pct)}%` : '—'}
        </div>
      </div>
      <span className="mt-2 text-center text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
