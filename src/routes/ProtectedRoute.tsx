import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore, isAuthenticated } from '@/stores/auth'

export function ProtectedRoute() {
  const authed = useAuthStore(isAuthenticated)
  return authed ? <Outlet /> : <Navigate to="/login" replace />
}
