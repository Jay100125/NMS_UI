import { render, screen, waitFor } from '@testing-library/react'
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
  return queryClient
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

test('clamps page when polled data shrinks between refetches', async () => {
  // Start with 60 rows
  const rows60 = Array.from({ length: 60 }, (_, i) => ({
    id: 60 - i,
    job_id: 5,
    metric_type: 'CPU',
    data: { system_cpu_percent: 12.5 },
    polled_at: new Date(Date.now() - (i * 1000 * 60)).toISOString(),
  }))

  server.use(
    http.get('*/api/polled-data/5', () =>
      HttpResponse.json({
        'status.code': 200,
        status: 'success',
        result: rows60,
      }),
    ),
  )

  const queryClient = renderGrid(5)
  await screen.findAllByRole('row')

  // Navigate to page 2
  await userEvent.click(screen.getByRole('button', { name: /next/i }))
  expect(screen.getByText(/page 2/i)).toBeInTheDocument()

  // Swap MSW handler to return only 10 rows
  const rows10 = Array.from({ length: 10 }, (_, i) => ({
    id: 10 - i,
    job_id: 5,
    metric_type: 'CPU',
    data: { system_cpu_percent: 99.9 }, // Different value to detect swap
    polled_at: new Date(Date.now() - (i * 1000 * 60)).toISOString(),
  }))

  server.use(
    http.get('*/api/polled-data/5', () =>
      HttpResponse.json({
        'status.code': 200,
        status: 'success',
        result: rows10,
      }),
    ),
  )

  // Invalidate and refetch the query to trigger a rerender with new data
  await queryClient.invalidateQueries({ queryKey: ['polled', 5] })

  // Wait for the new data (99.9 value) to appear, proving the refetch happened
  await waitFor(() => {
    expect(screen.getAllByText(/system_cpu_percent: 99.9/).length).toBeGreaterThan(0)
  })

  // Verify rows are shown even though page was > pageCount (not empty)
  const tableRows = screen.getAllByRole('row')
  expect(tableRows.length).toBeGreaterThan(1) // header + at least one row
})
