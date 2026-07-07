import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { CredentialDrawer } from './CredentialDrawer'

test('creates a credential with encrypted-at-rest payload shape', async () => {
  let received: any = null
  server.use(http.post('*/api/credential', async ({ request }) => {
    received = await request.json()
    return HttpResponse.json({ 'status.code': 201, status: 'success', result: [{ id: 9 }] })
  }))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <CredentialDrawer open onOpenChange={() => {}} editing={null} />
    </QueryClientProvider>,
  )
  await userEvent.type(screen.getByLabelText(/name/i), 'linux-root')
  await userEvent.type(screen.getByLabelText(/^user$/i), 'root')
  await userEvent.type(screen.getByLabelText(/password/i), 'hunter2!')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  await waitFor(() => expect(received).toMatchObject({
    credential_name: 'linux-root',
    protocol: 'LINUX',
    cred_data: { user: 'root', password: 'hunter2!' },
  }))
})

test('shows a community field for SNMP and submits {community}', async () => {
  let received: any = null
  server.use(http.post('*/api/credential', async ({ request }) => {
    received = await request.json()
    return HttpResponse.json({ 'status.code': 201, status: 'success', result: [{ id: 10 }] })
  }))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <CredentialDrawer open onOpenChange={() => {}} editing={null} />
    </QueryClientProvider>,
  )

  await userEvent.click(screen.getByRole('combobox'))
  await userEvent.click(screen.getByRole('option', { name: 'SNMP' }))

  expect(screen.queryByLabelText(/^user$/i)).not.toBeInTheDocument()
  await userEvent.type(screen.getByLabelText(/community/i), 'public')
  await userEvent.type(screen.getByLabelText(/name/i), 'snmp-cred')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))

  await waitFor(() => expect(received).toMatchObject({
    credential_name: 'snmp-cred',
    protocol: 'SNMP',
    cred_data: { community: 'public' },
  }))
})
