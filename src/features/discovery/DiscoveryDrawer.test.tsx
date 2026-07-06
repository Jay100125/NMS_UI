import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DiscoveryDrawer } from './DiscoveryDrawer'

test('creates a discovery with the dotted ip.address wire shape', async () => {
  server.use(
    http.get('*/api/credential', () => HttpResponse.json({ 'status.code': 200, status: 'success',
      result: [{ id: 3, credential_name: 'linux', system_type: 'LINUX', cred_data: 'x' }] })),
  )
  let body: any = null
  server.use(http.post('*/api/discovery', async ({ request }) => {
    body = await request.json()
    return HttpResponse.json({ 'status.code': 201, status: 'success', result: [{ id: 1 }] })
  }))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <DiscoveryDrawer open onOpenChange={() => {}} editing={null} />
    </QueryClientProvider>,
  )
  await userEvent.type(screen.getByLabelText(/name/i), 'lab')
  await userEvent.type(screen.getByLabelText(/^ip$/i), '10.0.0.1')
  await userEvent.clear(screen.getByLabelText(/port/i)); await userEvent.type(screen.getByLabelText(/port/i), '22')
  await waitFor(() => screen.getByText('linux'))
  await userEvent.click(screen.getByLabelText(/linux/i))
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  await waitFor(() => expect(body).toMatchObject({
    discovery_profile_name: 'lab', 'ip.address': '10.0.0.1', port: 22, credential_profile_id: [3],
  }))
})
