import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { ProvisioningPage } from './ProvisioningPage'

test('lists provisioning jobs', async () => {
  server.use(http.get('*/api/provision', () => HttpResponse.json({ 'status.code': 200, status: 'success',
    result: [{ id: 5, ip: '10.0.0.1', port: 22, credential_name: 'linux', system_type: 'LINUX' }] })))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter><ProvisioningPage /></MemoryRouter>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByText('10.0.0.1')).toBeInTheDocument())
  expect(screen.getByText('linux')).toBeInTheDocument()
})
