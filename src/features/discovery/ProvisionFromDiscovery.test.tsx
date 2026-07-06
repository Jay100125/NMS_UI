import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DiscoveryDetailPage } from './DiscoveryDetailPage'

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

test('provisions selected COMPLETED IPs', async () => {
  let body: any = null; let calledPath = ''
  server.use(
    http.get('*/api/discovery/1', () => ok([{ id: 1, discovery_profile_name: 'lab', ip: '10.0.0.1', port: 22, status: 'COMPLETED', credential_profile_ids: [3] }])),
    http.get('*/api/discovery/1/result', () => ok([{ id: 9, discovery_id: 1, ip: '10.0.0.1', port: 22, msg: 'ok', credential_profile_id: 3, result: 'COMPLETED' }])),
    http.post('*/api/provision/1', async ({ request }) => { calledPath = '/api/provision/1'; body = await request.json(); return HttpResponse.json({ 'status.code': 201, status: 'success', result: [{ insertedRecords: [] }] }) }),
  )
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter initialEntries={['/discovery/1']}>
        <Routes>
          <Route path="/discovery/:id" element={<DiscoveryDetailPage />} />
          <Route path="/provisioning" element={<div>jobs</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await waitFor(() => screen.getByText('10.0.0.1'))
  await userEvent.click(screen.getByRole('checkbox'))
  await userEvent.click(screen.getByRole('button', { name: /provision selected/i }))
  await waitFor(() => { expect(calledPath).toBe('/api/provision/1'); expect(body).toEqual({ selected_ips: ['10.0.0.1'] }) })
})
