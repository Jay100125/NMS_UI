import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { makeQueryClient } from '@/lib/queryClient'
import { LoginPage } from './LoginPage'
import { useAuthStore } from '@/stores/auth'

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter><LoginPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

test('logs in and stores session', async () => {
  useAuthStore.getState().logout()
  renderPage()
  await userEvent.type(screen.getByLabelText(/username/i), 'admin')
  await userEvent.type(screen.getByLabelText(/password/i), 'password1')
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
  await waitFor(() => expect(useAuthStore.getState().token).toBe('jwt-test-token'))
})
