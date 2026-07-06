import { useAuthStore } from './auth'

beforeEach(() => {
  localStorage.clear()
  useAuthStore.getState().logout()
})

test('setSession stores token and persists', () => {
  useAuthStore.getState().setSession('jwt-123', 'admin')
  expect(useAuthStore.getState().token).toBe('jwt-123')
  expect(JSON.parse(localStorage.getItem('nms.auth')!)).toMatchObject({ token: 'jwt-123', username: 'admin' })
})

test('logout clears token and storage', () => {
  useAuthStore.getState().setSession('jwt-123', 'admin')
  useAuthStore.getState().logout()
  expect(useAuthStore.getState().token).toBeNull()
})
