import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DashboardPage } from './DashboardPage'

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

test('shows a device count and its up/down state', async () => {
  server.use(
    http.get('*/api/provision', () => ok([{ id: 5, ip: '10.0.0.1', port: 22, credential_name: 'linux', system_type: 'LINUX' }])),
    http.get('*/api/availability/5', () => ok([{ provisioning_job_id: 5, is_up: true, last_change: '2026-07-06T10:00:00Z', up_samples: 9, total_samples: 10, availability_pct: 90 }])),
  )
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter><DashboardPage /></MemoryRouter>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByText('10.0.0.1')).toBeInTheDocument())
  expect(screen.getByText(/90.0%/)).toBeInTheDocument()
})
