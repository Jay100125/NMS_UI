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

  const detail = useDiscoveryDetail(id)
  const isActive = state.runState === 'RUNNING' || detail.data?.status === 'RUNNING'
  const results = useDiscoveryResults(id, isActive)

  // Seed / fallback-merge whenever persisted data changes.
  const seedRef = useRef<(r: Parameters<typeof seedFromResults>[1], s: string) => void>(() => {})
  seedRef.current = (r, s) => dispatch({ __seed: { results: r, status: s } } as never)

  useEffect(() => {
    if (results.data && detail.data) seedRef.current(results.data, detail.data.status)
  }, [results.data, detail.data])

  useEffect(() => {
    if (!Number.isFinite(id)) return
    return subscribe(`nms.discovery.${id}`, (body) => dispatch(body as never), setLive)
  }, [id])

  return { state, summary: summarize(state), live }
}
