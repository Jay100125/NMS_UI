import type { DiscoveryResult } from '@/lib/types'

export interface ProgressRow {
  ip: string
  stage: 'PING' | 'PORT' | 'PLUGIN' | null
  progress: number
  status: 'pending' | 'ok' | 'failed' | 'completed'
  message?: string
}

export interface ProgressState {
  runState: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  runMessage?: string
  rows: Record<string, ProgressRow>
}

export const initialProgress: ProgressState = { runState: 'IDLE', rows: {} }

function isTerminal(row: ProgressRow): boolean {
  return row.status === 'completed' || row.status === 'failed'
}

/** Applies one bridge event ({type: state|targets|progress}); unknown shapes are ignored. */
export function reduceProgress(state: ProgressState, event: unknown): ProgressState {
  if (typeof event !== 'object' || event === null) return state
  const e = event as Record<string, unknown>

  if (e.type === 'state' && typeof e.status === 'string') {
    return { ...state, runState: e.status as ProgressState['runState'], runMessage: e.message as string | undefined }
  }

  if (e.type === 'targets' && Array.isArray(e.ips)) {
    const rows = { ...state.rows }
    for (const ip of e.ips as string[]) {
      // Seeded terminal rows (page reload) win over the fresh pending row.
      if (!rows[ip]) rows[ip] = { ip, stage: null, progress: 0, status: 'pending' }
    }
    return { ...state, rows }
  }

  if (e.type === 'progress' && typeof e.ip === 'string' && typeof e.progress === 'number') {
    const current = state.rows[e.ip]
    // COMPLETED wins: a later failed credential attempt must not downgrade the row.
    if (current && current.status === 'completed') return state
    const status: ProgressRow['status'] =
      e.status === 'COMPLETED' ? 'completed'
      : e.status === 'FAILED' || e.status === 'failed' ? 'failed'
      : 'ok'
    const row: ProgressRow = {
      ip: e.ip,
      stage: (e.stage as ProgressRow['stage']) ?? null,
      progress: e.progress,
      status,
      message: e.message as string | undefined,
    }
    return { ...state, rows: { ...state.rows, [e.ip]: row } }
  }

  return state
}

/** Rebuilds state from persisted results (page load/reload); live events overlay afterwards. */
export function seedFromResults(state: ProgressState, results: DiscoveryResult[], profileStatus: string): ProgressState {
  const rows = { ...state.rows }
  for (const r of results) {
    const existing = rows[r.ip]
    if (existing && isTerminal(existing)) continue
    rows[r.ip] = {
      ip: r.ip,
      stage: 'PLUGIN',
      progress: 100,
      status: r.result === 'COMPLETED' ? 'completed' : 'failed',
      message: r.msg ?? undefined,
    }
  }
  const runState = profileStatus === 'RUNNING' ? 'RUNNING'
    : profileStatus === 'COMPLETED' ? 'COMPLETED'
    : profileStatus === 'FAILED' ? 'FAILED'
    : state.runState
  return { ...state, runState, rows }
}

export function summarize(state: ProgressState): { total: number; discovered: number; failed: number; overallPct: number } {
  const rows = Object.values(state.rows)
  const total = rows.length
  const discovered = rows.filter((r) => r.status === 'completed').length
  const failed = rows.filter((r) => r.status === 'failed').length
  const overallPct = total === 0 ? 0 : Math.round(rows.reduce((sum, r) => sum + r.progress, 0) / total)
  return { total, discovered, failed, overallPct }
}
