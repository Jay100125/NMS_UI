import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { RegisterPage } from './RegisterPage'

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter><RegisterPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

test('submits registration form and calls the register endpoint', async () => {
  let capturedBody: unknown
  server.use(http.post('*/api/register', async ({ request }) => {
    capturedBody = await request.json()
    return HttpResponse.json({ 'status.code': 201, status: 'success', result: [{ id: 1 }] })
  }))

  renderPage()
  await userEvent.type(screen.getByLabelText(/username/i), 'newuser')
  await userEvent.type(screen.getByLabelText(/password/i), 'password1')
  await userEvent.click(screen.getByRole('button', { name: /create account/i }))

  await waitFor(() => expect(capturedBody).toEqual({ username: 'newuser', password: 'password1' }))
})
