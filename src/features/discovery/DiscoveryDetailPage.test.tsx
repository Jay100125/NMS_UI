import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DiscoveryDetailPage } from './DiscoveryDetailPage'

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/discovery/:id" element={<DiscoveryDetailPage />} />
          <Route path="/discovery/:id/progress" element={<div>progress page</div>} />
          <Route path="/discovery/:id/result" element={<div>result page</div>} />
          <Route path="/discovery/:id/edit" element={<div>edit page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  server.use(
    http.get('*/api/discovery/1', () => ok([{ id: 1, discovery_profile_name: 'lab', ip: '10.0.0.1', port: 22, plugin_type: 'LINUX', status: 'COMPLETED', credential_profile_ids: [3] }])),
  )
})

test('shows the profile summary with status and plugin type badges', async () => {
  renderAt('/discovery/1')

  await waitFor(() => expect(screen.getByText('lab')).toBeInTheDocument())
  expect(screen.getByText('10.0.0.1:22')).toBeInTheDocument()
  expect(screen.getByText('COMPLETED')).toBeInTheDocument()
  expect(screen.getByText('LINUX')).toBeInTheDocument()
})

test('Results navigates to the result page', async () => {
  renderAt('/discovery/1')

  await waitFor(() => screen.getByText('lab'))
  await userEvent.click(screen.getByRole('button', { name: /results/i }))
  await waitFor(() => expect(screen.getByText('result page')).toBeInTheDocument())
})

test('Run navigates to the live progress page', async () => {
  server.use(
    http.post('*/api/discovery/1/run', () => ok([{ id: 1 }])),
  )
  renderAt('/discovery/1')

  await waitFor(() => screen.getByText('lab'))
  await userEvent.click(screen.getByRole('button', { name: /^run$/i }))
  await waitFor(() => expect(screen.getByText('progress page')).toBeInTheDocument())
})
