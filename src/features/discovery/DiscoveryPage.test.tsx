import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DiscoveryPage } from './DiscoveryPage'

test('lists discovery profiles with status', async () => {
  server.use(http.get('*/api/discovery', () =>
    HttpResponse.json({ 'status.code': 200, status: 'success', result: [
      { id: 1, discovery_profile_name: 'lab', ip: '10.0.0.1', port: 22, status: 'COMPLETED', credential_profile_ids: [3] },
    ] })))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter><DiscoveryPage /></MemoryRouter>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByText('lab')).toBeInTheDocument())
  expect(screen.getByText('COMPLETED')).toBeInTheDocument()
})
