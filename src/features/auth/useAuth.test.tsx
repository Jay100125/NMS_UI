import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { makeQueryClient } from '@/lib/queryClient'
import { useLogin } from './useAuth'
import { useAuthStore } from '@/stores/auth'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={makeQueryClient(false)}>{children}</QueryClientProvider>
)

test('useLogin stores the returned token', async () => {
  useAuthStore.getState().logout()
  const { result } = renderHook(() => useLogin(), { wrapper })
  result.current.mutate({ username: 'admin', password: 'password1' })
  await waitFor(() => expect(useAuthStore.getState().token).toBe('jwt-test-token'))
})
