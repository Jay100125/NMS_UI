import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { CredentialDrawer } from './CredentialDrawer'
import type { Credential } from '@/lib/types'

const editing: Credential = { id: 7, credential_name: 'linux-root', system_type: 'LINUX' } as Credential

test('editing without a password omits cred_data from the PATCH body', async () => {
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

  const nameInput = await screen.findByLabelText(/name/i)
  expect(nameInput).toHaveValue('linux-root')
  await userEvent.clear(nameInput)
  await userEvent.type(nameInput, 'linux-root-renamed')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))

  await waitFor(() => expect(received).not.toBeNull())
  expect(received).toEqual({ credential_name: 'linux-root-renamed', protocol: 'LINUX' })
  expect(received).not.toHaveProperty('cred_data')
})
