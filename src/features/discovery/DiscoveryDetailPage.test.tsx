import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DiscoveryDetailPage } from './DiscoveryDetailPage'

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

test('shows the profile and its per-IP results', async () => {
  server.use(
    http.get('*/api/discovery/1', () => ok([{ id: 1, discovery_profile_name: 'lab', ip: '10.0.0.1', port: 22, status: 'COMPLETED', credential_profile_ids: [3] }])),
    http.get('*/api/discovery/1/result', () => ok([{ id: 9, discovery_id: 1, ip: '10.0.0.1', port: 22, msg: 'ok', credential_profile_id: 3, result: 'COMPLETED' }])),
  )
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter initialEntries={['/discovery/1']}>
        <Routes><Route path="/discovery/:id" element={<DiscoveryDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByText('lab')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByText('10.0.0.1')).toBeInTheDocument())
})
