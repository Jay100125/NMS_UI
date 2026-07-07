import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { useDiscoveryDetail } from './useDiscoveryDetail'

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={makeQueryClient(false)}>{children}</QueryClientProvider>
)

// Degraded-mode completion (finding 1): when the live socket never connects,
// useDiscoveryProgress relies on useDiscoveryDetail's refetchInterval to notice
// the backend has finished the run. Verified here with a short real interval
// (no fake timers — the existing hook tests in this repo use real timers with
// waitFor, and that pattern is non-flaky) rather than the exact 3000ms constant,
// which is exercised indirectly through useDiscoveryProgress. The wiring between
// useDiscoveryProgress and this option is additionally checked by `tsc` (npm run lint).
test('honors a passed refetchInterval and keeps polling', async () => {
  let calls = 0
  server.use(
    http.get('*/api/discovery/1', () => {
      calls += 1
      return ok([{ id: 1, discovery_profile_name: 'lab', ip: '10.0.0.1', port: 22, status: 'RUNNING', credential_profile_ids: [1] }])
    }),
  )

  const { result } = renderHook(() => useDiscoveryDetail(1, { refetchInterval: 30 }), { wrapper })

  await waitFor(() => expect(result.current.data).toBeDefined())
  await waitFor(() => expect(calls).toBeGreaterThanOrEqual(3), { timeout: 2000 })
})

test('does not poll when refetchInterval is false (default)', async () => {
  let calls = 0
  server.use(
    http.get('*/api/discovery/2', () => {
      calls += 1
      return ok([{ id: 2, discovery_profile_name: 'lab2', ip: '10.0.0.2', port: 22, status: 'COMPLETED', credential_profile_ids: [1] }])
    }),
  )

  const { result } = renderHook(() => useDiscoveryDetail(2), { wrapper })

  await waitFor(() => expect(result.current.data).toBeDefined())
  await new Promise((r) => setTimeout(r, 200))
  expect(calls).toBe(1)
})
