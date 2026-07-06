export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString()
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}
