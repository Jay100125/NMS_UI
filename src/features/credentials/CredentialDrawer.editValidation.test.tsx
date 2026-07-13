import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { CredentialDrawer } from './CredentialDrawer'
import type { Credential } from '@/lib/types'

const editing: Credential = { id: 7, credential_name: 'linux-root', system_type: 'LINUX' } as Credential
const editingSnmp: Credential = { id: 8, credential_name: 'snmp-public', system_type: 'SNMP' } as Credential

test('editing with only a password (no user) blocks submission and shows a validation error', async () => {
  let received: any = null
  server.use(http.patch('*/api/credential/7', async ({ request }) => {
    received = await request.json()
    return HttpResponse.json({ 'status.code': 200, status: 'success', result: [{ id: 7 }] })
  }))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <CredentialDrawer open onOpenChange={() => {}} editing={editing} />
    </QueryClientProvider>,
  )

  await userEvent.type(await screen.findByLabelText('Password'), 'newSecret1!')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))

  await waitFor(() => expect(screen.getByText(/enter both user and password/i)).toBeInTheDocument())
  expect(received).toBeNull()
})

test('editing with both user and password rotates cred_data', async () => {
  let received: any = null
  server.use(http.patch('*/api/credential/7', async ({ request }) => {
    received = await request.json()
    return HttpResponse.json({ 'status.code': 200, status: 'success', result: [{ id: 7 }] })
  }))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <CredentialDrawer open onOpenChange={() => {}} editing={editing} />
    </QueryClientProvider>,
  )

  await userEvent.type(await screen.findByLabelText(/^user$/i), 'newuser')
  await userEvent.type(screen.getByLabelText('Password'), 'newSecret1!')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))

  await waitFor(() => expect(received).not.toBeNull())
  expect(received).toEqual({
    credential_name: 'linux-root',
    protocol: 'LINUX',
    cred_data: { user: 'newuser', password: 'newSecret1!' },
  })
})

test('editing a LINUX credential and switching type to SNMP requires a fresh community', async () => {
  let received: any = null
  server.use(http.patch('*/api/credential/7', async ({ request }) => {
    received = await request.json()
    return HttpResponse.json({ 'status.code': 200, status: 'success', result: [{ id: 7 }] })
  }))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <CredentialDrawer open onOpenChange={() => {}} editing={editing} />
    </QueryClientProvider>,
  )

  await userEvent.click(await screen.findByRole('button', { name: /snmp/i }))

  await userEvent.click(screen.getByRole('button', { name: /save/i }))

  await waitFor(() => expect(screen.getByText(/community is required/i)).toBeInTheDocument())
  expect(received).toBeNull()
})

test('editing an SNMP credential without a community omits cred_data from the PATCH body', async () => {
  let received: any = null
  server.use(http.patch('*/api/credential/8', async ({ request }) => {
    received = await request.json()
    return HttpResponse.json({ 'status.code': 200, status: 'success', result: [{ id: 8 }] })
  }))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <CredentialDrawer open onOpenChange={() => {}} editing={editingSnmp} />
    </QueryClientProvider>,
  )

  await screen.findByLabelText(/name/i)
  await userEvent.click(screen.getByRole('button', { name: /save/i }))

  await waitFor(() => expect(received).not.toBeNull())
  expect(received).toEqual({ credential_name: 'snmp-public', protocol: 'SNMP' })
  expect(received).not.toHaveProperty('cred_data')
})
