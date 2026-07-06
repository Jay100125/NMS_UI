import { render, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { MetricCharts } from './MetricCharts'

const capturedSeries: { name: string; points: [number, number][] }[][] = []

vi.mock('@/components/MetricChart', () => ({
  MetricChart: ({ series }: { series: { name: string; points: [number, number][] }[] }) => {
    capturedSeries.push(series)
    return <div data-testid="metric-chart" />
  },
}))

test('sorts newest-first polled data ascending by timestamp before charting', async () => {
  capturedSeries.length = 0
  server.use(http.get('*/api/polled-data/11', () => HttpResponse.json({
    'status.code': 200,
    status: 'success',
    result: [
      { id: 3, job_id: 11, metric_type: 'cpu', data: { value: 30 }, polled_at: '2026-07-06T10:02:00Z' },
      { id: 2, job_id: 11, metric_type: 'cpu', data: { value: 20 }, polled_at: '2026-07-06T10:01:00Z' },
      { id: 1, job_id: 11, metric_type: 'cpu', data: { value: 10 }, polled_at: '2026-07-06T10:00:00Z' },
    ],
  })))

  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MetricCharts jobId={11} />
    </QueryClientProvider>,
  )

  await waitFor(() => expect(capturedSeries.length).toBeGreaterThan(0))

  const points = capturedSeries[capturedSeries.length - 1][0].points
  expect(points.map((p) => p[1])).toEqual([10, 20, 30])
  expect(points[0][0]).toBeLessThan(points[1][0])
  expect(points[1][0]).toBeLessThan(points[2][0])
})
