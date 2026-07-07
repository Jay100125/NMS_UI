import { useEffect, useReducer, useRef, useState } from 'react'
import { subscribe } from '@/lib/eventbus'
import { useDiscoveryDetail, useDiscoveryResults } from './useDiscoveryDetail'
import { initialProgress, reduceProgress, seedFromResults, summarize } from './progress'

/**
 * Live discovery progress: seeds from persisted results (reload-safe), then
 * overlays bridge events from nms.discovery.<id>. Polling of results stays on
 * while the run is active as the degraded-mode fallback (seed merges are
 * idempotent — terminal rows win).
 */
export function useDiscoveryProgress(id: number) {
  const [state, dispatch] = useReducer(reduceProgress, initialProgress)
  const [live, setLive] = useState(false)

  // isActive normally needs detail.data (to catch a run still RUNNING server-side
  // even before any live event arrives), but detail's own refetchInterval needs
  // isActive — a chicken-and-egg problem within the same render. We break the
  // cycle by driving the poll off the *previous* render's isActive; the interval
  // simply starts one render later, once detail has first loaded, which is fine
  // since detail.data is undefined (and polling therefore moot) until then.
  const isActiveRef = useRef(false)
  const detail = useDiscoveryDetail(id, { refetchInterval: isActiveRef.current ? 3000 : false })
  const isActive = state.runState === 'RUNNING' || detail.data?.status === 'RUNNING'
  isActiveRef.current = isActive
  const results = useDiscoveryResults(id, isActive)

  // Seed / fallback-merge whenever persisted data changes.
  const seedRef = useRef<(r: Parameters<typeof seedFromResults>[1], s: string) => void>(() => {})
  seedRef.current = (r, s) => dispatch({ __seed: { results: r, status: s } } as never)

  // Only seed from data that was actually (re)fetched after this page mounted —
  // not from a synchronously-served stale cache entry. Re-running a previously
  // COMPLETED profile navigates here while TanStack Query still holds the old
  // COMPLETED detail + terminal results; seeding from that snapshot would mark
  // runState COMPLETED immediately and the auto-navigate effect would bounce
  // straight back to /result before the fresh RUNNING status ever loads.
  useEffect(() => {
    if (results.data && detail.data && results.isFetchedAfterMount && detail.isFetchedAfterMount) {
      seedRef.current(results.data, detail.data.status)
    }
  }, [results.data, detail.data, results.isFetchedAfterMount, detail.isFetchedAfterMount])

  useEffect(() => {
    if (!Number.isFinite(id)) return
    return subscribe(`nms.discovery.${id}`, (body) => dispatch(body as never), setLive)
  }, [id])

  return { state, summary: summarize(state), live }
}
