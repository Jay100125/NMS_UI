import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { AvailabilityPanel } from './AvailabilityPanel'

test('shows uptime percent when available', async () => {
  server.use(http.get('*/api/availability/5', () => HttpResponse.json({ 'status.code': 200, status: 'success',
    result: [{ provisioning_job_id: 5, is_up: true, last_change: '2026-07-06T10:00:00Z', up_samples: 9, total_samples: 10, availability_pct: 90 }] })))
  render(
    <QueryClientProvider client={makeQueryClient(false)}><AvailabilityPanel jobId={5} /></QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByText(/90.0%/)).toBeInTheDocument())
})

test('shows empty message on 404', async () => {
  server.use(http.get('*/api/availability/7', () => HttpResponse.json({ 'status.code': 404, status: 'failure', error: 'not found' }, { status: 404 })))
  render(
    <QueryClientProvider client={makeQueryClient(false)}><AvailabilityPanel jobId={7} /></QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByText(/no availability data/i)).toBeInTheDocument())
})
