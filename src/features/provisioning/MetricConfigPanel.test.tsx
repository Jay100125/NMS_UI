import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { MetricConfigPanel } from './MetricConfigPanel'

test('saves the full metrics array', async () => {
  let body: any = null
  server.use(http.put('*/api/provision/5/metrics', async ({ request }) => { body = await request.json(); return HttpResponse.json({ 'status.code': 200, status: 'success', result: [5] }) }))
  const job = { id: 5, ip: '10.0.0.1', port: 22, metrics: [{ metric_name: 'CPU', polling_interval: 300, is_enabled: true }] }
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MetricConfigPanel job={job} />
    </QueryClientProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  await waitFor(() => expect(body).toEqual({ metrics: [{ metric_name: 'CPU', polling_interval: 300, is_enabled: true }] }))
})
