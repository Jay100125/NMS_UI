import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DiscoveryResultPage } from './DiscoveryResultPage'

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/discovery/:id/result" element={<DiscoveryResultPage />} />
          <Route path="/discovery/:id" element={<div>profile page</div>} />
          <Route path="/inventory" element={<div>inventory</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  server.use(
    http.get('*/api/discovery/3', () => ok([
      { id: 3, discovery_profile_name: 'lab', ip: '10.0.0.0/24', port: 22, plugin_type: 'LINUX', status: 'COMPLETED', credential_profile_ids: [1] },
    ])),
    http.get('*/api/discovery/3/result', () => ok([
      { id: 9, discovery_id: 3, ip: '10.0.0.1', port: 22, msg: 'ok', credential_profile_id: 1, result: 'COMPLETED' },
      { id: 10, discovery_id: 3, ip: '10.0.0.2', port: 22, msg: 'unreachable', credential_profile_id: 1, result: 'FAILED' },
    ])),
  )
})

test('shows the profile name and a link back to the profile', async () => {
  renderAt('/discovery/3/result')

  await waitFor(() => expect(screen.getByText('lab')).toBeInTheDocument())
  expect(screen.getByRole('link', { name: /back to profile/i })).toHaveAttribute('href', '/discovery/3')
})

test('only COMPLETED rows get a checkbox', async () => {
  renderAt('/discovery/3/result')

  await waitFor(() => expect(screen.getByText('10.0.0.1')).toBeInTheDocument())
  expect(screen.getByText('10.0.0.2')).toBeInTheDocument()
  expect(screen.getAllByRole('checkbox')).toHaveLength(1)
})

test('provisions selected COMPLETED IPs and navigates to /inventory', async () => {
  let calledPath = ''; let body: any = null
  server.use(
    http.post('*/api/provision/3', async ({ request }) => {
      calledPath = '/api/provision/3'
      body = await request.json()
      return HttpResponse.json({ 'status.code': 201, status: 'success', result: [{ insertedRecords: [] }] })
    }),
  )

  renderAt('/discovery/3/result')

  await waitFor(() => screen.getByText('10.0.0.1'))
  await userEvent.click(screen.getByRole('checkbox'))
  await userEvent.click(screen.getByRole('button', { name: /provision selected/i }))

  await waitFor(() => {
    expect(calledPath).toBe('/api/provision/3')
    expect(body).toEqual({ selected_ips: ['10.0.0.1'] })
  })
  await waitFor(() => expect(screen.getByText('inventory')).toBeInTheDocument())
})
