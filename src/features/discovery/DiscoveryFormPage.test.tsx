import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DiscoveryFormPage } from './DiscoveryFormPage'

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/discovery/new" element={<DiscoveryFormPage />} />
          <Route path="/discovery/:id/edit" element={<DiscoveryFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

beforeEach(() => {
  server.use(
    http.get('*/api/credential', () => ok([
      { id: 1, credential_name: 'linux-cred', system_type: 'LINUX', cred_data: 'x' },
      { id: 2, credential_name: 'snmp-cred', system_type: 'SNMP', cred_data: 'x' },
    ])),
  )
})

test('filters credentials by device type and defaults the port', async () => {
  const user = userEvent.setup()
  renderAt('/discovery/new')

  // default LINUX: port 22, only the LINUX credential offered
  expect(await screen.findByDisplayValue('22')).toBeInTheDocument()
  expect(await screen.findByText('linux-cred')).toBeInTheDocument()
  expect(screen.queryByText('snmp-cred')).not.toBeInTheDocument()

  await user.click(screen.getByRole('combobox', { name: /device type/i }))
  await user.click(screen.getByRole('option', { name: 'SNMP' }))

  expect(await screen.findByDisplayValue('161')).toBeInTheDocument()
  expect(await screen.findByText('snmp-cred')).toBeInTheDocument()
  expect(screen.queryByText('linux-cred')).not.toBeInTheDocument()
})

test('rejects an invalid CIDR before submitting', async () => {
  const user = userEvent.setup()
  renderAt('/discovery/new')
  await user.click(screen.getByRole('combobox', { name: /target type/i }))
  await user.click(screen.getByRole('option', { name: 'CIDR' }))
  await user.type(screen.getByLabelText('Target'), '10.0.0.0/40')
  await user.type(screen.getByLabelText('Name'), 'bad')
  await user.click(screen.getByRole('button', { name: /save/i }))
  expect(await screen.findByText(/mask must be 0-32/i)).toBeInTheDocument()
})

// Migrated from the deleted DiscoveryDrawer.test.tsx: the backend write shape
// uses a dotted `ip.address` key and `credential_profile_id` as an array.
test('creates a discovery with the dotted ip.address wire shape', async () => {
  const user = userEvent.setup()
  let body: any = null
  server.use(http.post('*/api/discovery', async ({ request }) => {
    body = await request.json()
    return HttpResponse.json({ 'status.code': 201, status: 'success', result: [{ id: 1 }] })
  }))
  renderAt('/discovery/new')

  await user.type(screen.getByLabelText('Name'), 'lab')
  await user.type(screen.getByLabelText('Target'), '10.0.0.1')
  await waitFor(() => screen.getByText('linux-cred'))
  await user.click(screen.getByLabelText('linux-cred'))
  await user.click(screen.getByRole('button', { name: /save/i }))

  await waitFor(() => expect(body).toMatchObject({
    discovery_profile_name: 'lab',
    'ip.address': '10.0.0.1',
    port: 22,
    credential_profile_id: [1],
    plugin_type: 'LINUX',
  }))
})

test('prefills from the existing profile and submits an update', async () => {
  const user = userEvent.setup()
  server.use(
    http.get('*/api/discovery/5', () => ok([
      { id: 5, discovery_profile_name: 'edit-me', ip: '10.0.0.9', port: 161, plugin_type: 'SNMP', status: 'PENDING', credential_profile_ids: [2] },
    ])),
  )
  let body: any = null
  server.use(http.put('*/api/discovery/5', async ({ request }) => {
    body = await request.json()
    return HttpResponse.json({ 'status.code': 200, status: 'success', result: [{ id: 5 }] })
  }))

  renderAt('/discovery/5/edit')

  expect(await screen.findByDisplayValue('edit-me')).toBeInTheDocument()
  expect(await screen.findByDisplayValue('10.0.0.9')).toBeInTheDocument()
  expect(await screen.findByDisplayValue('161')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /save/i }))

  await waitFor(() => expect(body).toMatchObject({
    discovery_profile_name: 'edit-me',
    'ip.address': '10.0.0.9',
    port: 161,
    credential_profile_id: [2],
    plugin_type: 'SNMP',
  }))
})
