import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuthStore } from '@/stores/auth'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/secret" element={<div>secret</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

test('redirects to login when unauthenticated', () => {
  useAuthStore.getState().logout()
  renderAt('/secret')
  expect(screen.getByText('login page')).toBeInTheDocument()
})

test('renders child when authenticated', () => {
  useAuthStore.getState().setSession('jwt', 'admin')
  renderAt('/secret')
  expect(screen.getByText('secret')).toBeInTheDocument()
})
