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

const RUN_STATUSES = new Set(['RUNNING', 'COMPLETED', 'FAILED'])

/** Applies one bridge event ({type: state|targets|progress}); unknown shapes are ignored. */
export function reduceProgress(state: ProgressState, event: unknown): ProgressState {
  if (typeof event !== 'object' || event === null) return state
  const e = event as Record<string, unknown>

  const seed = (event as { __seed?: { results: DiscoveryResult[]; status: string } } | null)?.__seed
  if (seed) return seedFromResults(state, seed.results, seed.status)

  if (e.type === 'state') {
    if (typeof e.status !== 'string' || !RUN_STATUSES.has(e.status)) return state
    return { ...state, runState: e.status as ProgressState['runState'], runMessage: e.message as string | undefined }
  }

  if (e.type === 'targets' && Array.isArray(e.ips)) {
    const rows = { ...state.rows }
    for (const ip of e.ips as unknown[]) {
      if (typeof ip !== 'string') continue
      // Seeded terminal rows (page reload) win over the fresh pending row.
      if (!rows[ip]) rows[ip] = { ip, stage: null, progress: 0, status: 'pending' }
    }
    return { ...state, rows }
  }

  if (e.type === 'progress' && typeof e.ip === 'string' && Number.isFinite(e.progress)) {
    const current = state.rows[e.ip]
    const status: ProgressRow['status'] =
      e.status === 'COMPLETED' ? 'completed'
      : e.status === 'FAILED' || e.status === 'failed' ? 'failed'
      : 'ok'
    if (current) {
      // COMPLETED wins outright: nothing downgrades a completed row.
      if (current.status === 'completed') return state
      // A failed row may only be upgraded to completed (multi-credential discovery:
      // credential B succeeding after credential A failed) — a stray non-terminal
      // event (e.g. a later PING) must not un-fail it.
      if (current.status === 'failed' && status !== 'completed') return state
    }
    const row: ProgressRow = {
      ip: e.ip,
      stage: (e.stage as ProgressRow['stage']) ?? null,
      progress: e.progress as number,
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
