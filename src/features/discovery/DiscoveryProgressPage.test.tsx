import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DiscoveryProgressPage } from './DiscoveryProgressPage'

let pushEvent: (body: unknown) => void = () => {}
let pushStatus: (up: boolean) => void = () => {}
vi.mock('@/lib/eventbus', () => ({
  subscribe: (_addr: string, onMessage: (b: unknown) => void, onStatus?: (up: boolean) => void) => {
    pushEvent = onMessage
    pushStatus = (up: boolean) => onStatus?.(up)
    onStatus?.(true)
    return () => {}
  },
}))

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/discovery/:id/progress" element={<DiscoveryProgressPage />} />
          <Route path="/discovery/:id/result" element={<div data-testid="result-page-marker" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  server.use(
    http.get('*/api/discovery/3', () => ok([
      { id: 3, discovery_profile_name: 'lab', ip: '10.0.0.0/24', port: 22, status: 'RUNNING', credential_profile_ids: [1] },
    ])),
    http.get('*/api/discovery/3/result', () => ok([])),
  )
})

test('advances rows and tiles from live events, then navigates to result on completion', async () => {
  renderAt('/discovery/3/progress')

  await screen.findByText(/live/i)

  pushEvent({ type: 'targets', total: 2, ips: ['10.0.0.1', '10.0.0.2'] })
  expect(await screen.findByText('10.0.0.1')).toBeInTheDocument()
  expect(screen.getByTestId('tile-total')).toHaveTextContent('2')

  pushEvent({ type: 'progress', ip: '10.0.0.1', stage: 'PING', progress: 33.33, status: 'ok' })
  expect(await screen.findByText('PING')).toBeInTheDocument()

  pushEvent({ type: 'progress', ip: '10.0.0.1', stage: 'PLUGIN', progress: 100, status: 'COMPLETED' })
  await waitFor(() => expect(screen.getByTestId('tile-discovered')).toHaveTextContent('1'))

  pushEvent({ type: 'state', status: 'COMPLETED' })
  await waitFor(() => expect(screen.getByTestId('result-page-marker')).toBeInTheDocument())
})

test('shows the degraded indicator when the socket is down', async () => {
  renderAt('/discovery/3/progress')

  pushStatus(false)

  expect(await screen.findByText(/live updates unavailable/i)).toBeInTheDocument()
})
