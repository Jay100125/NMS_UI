export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString()
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}

/** Humanize a raw byte count to B/KB/MB/GB/… (base 1024). */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const neg = n < 0
  let v = Math.abs(n)
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const digits = i === 0 ? 0 : v < 10 ? 2 : v < 100 ? 1 : 0
  return `${neg ? '-' : ''}${v.toFixed(digits)} ${units[i]}`
}

/** Byte rate, e.g. "1.2 MB/s". */
export function formatBytesPerSec(n: number): string {
  return `${formatBytes(n)}/s`
}

/** Compact uptime, e.g. "3d 4h" / "5h 12m" / "8m". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  const s = Math.max(0, Math.floor(seconds))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
