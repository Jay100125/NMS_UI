import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { PolledDataGrid } from './PolledDataGrid'

function renderGrid(jobId: number) {
  const queryClient = makeQueryClient(false)
  render(
    <QueryClientProvider client={queryClient}>
      <PolledDataGrid jobId={jobId} />
    </QueryClientProvider>,
  )
}

test('renders newest-first rows with formatted values and pages by 25', async () => {
  // Create 60 rows with newest first
  const rows = Array.from({ length: 60 }, (_, i) => ({
    id: 60 - i,
    job_id: 5,
    metric_type: 'CPU',
    data: { system_cpu_percent: 12.5 },
    polled_at: new Date(Date.now() - (i * 1000 * 60)).toISOString(), // Each row is 60s apart
  }))

  server.use(
    http.get('*/api/polled-data/5', () =>
      HttpResponse.json({
        'status.code': 200,
        status: 'success',
        result: rows,
      }),
    ),
  )

  renderGrid(5)
  const rows_in_table = await screen.findAllByRole('row')
  expect(rows_in_table.length).toBe(26) // header + first page of 25
  expect(screen.getAllByText('CPU').length).toBeGreaterThan(0) // at least one row has CPU metric
  expect(screen.getAllByText(/system_cpu_percent: 12.5/)[0]).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: /next/i }))
  expect(screen.getByText(/page 2/i)).toBeInTheDocument()
})
