import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DashboardPage } from './DashboardPage'

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

test('shows counts and quick links, and no avg-uptime KPI', async () => {
  // MSW: two jobs; availability job1 {is_up:true,...}, job2 {is_up:false,...}
  server.use(
    http.get('*/api/provision', () => ok([
      { id: 1, ip: '10.0.0.1', port: 22, credential_name: 'linux', system_type: 'LINUX' },
      { id: 2, ip: '10.0.0.2', port: 22, credential_name: 'linux', system_type: 'LINUX' },
    ])),
    http.get('*/api/availability/1', () => ok([{ provisioning_job_id: 1, is_up: true, last_change: '2026-07-06T10:00:00Z', up_samples: 9, total_samples: 10, availability_pct: 90 }])),
    http.get('*/api/availability/2', () => ok([{ provisioning_job_id: 2, is_up: false, last_change: '2026-07-06T10:00:00Z', up_samples: 1, total_samples: 10, availability_pct: 10 }])),
  )
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter><DashboardPage /></MemoryRouter>
    </QueryClientProvider>,
  )
  expect(await screen.findByTestId('devices-up')).toHaveTextContent('1')
  expect(screen.getByTestId('devices-down')).toHaveTextContent('1')
  expect(screen.getByTestId('total-devices')).toHaveTextContent('2')
  expect(screen.queryByTestId('avg-uptime')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /discovery/i })).toHaveAttribute('href', '/discovery')
  expect(screen.getByRole('link', { name: /devices/i })).toHaveAttribute('href', '/provisioning')
})
