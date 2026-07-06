import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { CredentialsPage } from './CredentialsPage'

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter><CredentialsPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

test('lists credentials from the api', async () => {
  server.use(http.get('*/api/credential', () =>
    HttpResponse.json({ 'status.code': 200, status: 'success', result: [
      { id: 1, credential_name: 'linux-root', system_type: 'LINUX', cred_data: 'enc' },
    ] })))
  renderPage()
  await waitFor(() => expect(screen.getByText('linux-root')).toBeInTheDocument())
  expect(screen.getByText('LINUX')).toBeInTheDocument()
})

test('deletes a credential after confirmation', async () => {
  server.use(http.get('*/api/credential', () =>
    HttpResponse.json({ 'status.code': 200, status: 'success', result: [
      { id: 7, credential_name: 'winrm-svc', system_type: 'WINRM', cred_data: 'enc' },
    ] })))

  let deletedId: string | undefined
  server.use(http.delete('*/api/credential/:id', ({ params }) => {
    deletedId = params.id as string
    return HttpResponse.json({ 'status.code': 200, status: 'success', result: [] })
  }))

  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderPage()
  await waitFor(() => expect(screen.getByText('winrm-svc')).toBeInTheDocument())

  await userEvent.click(screen.getByRole('button', { name: /delete/i }))

  await waitFor(() => expect(deletedId).toBe('7'))
  confirmSpy.mockRestore()
})
