import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AppLayout } from '@/components/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { Loading } from '@/components/states'

const CredentialsPage = lazy(() => import('@/features/credentials/CredentialsPage').then((m) => ({ default: m.CredentialsPage })))
const DiscoveryPage = lazy(() => import('@/features/discovery/DiscoveryPage').then((m) => ({ default: m.DiscoveryPage })))
const DiscoveryDetailPage = lazy(() => import('@/features/discovery/DiscoveryDetailPage').then((m) => ({ default: m.DiscoveryDetailPage })))
const DiscoveryResultPage = lazy(() => import('@/features/discovery/DiscoveryResultPage').then((m) => ({ default: m.DiscoveryResultPage })))
const DiscoveryFormPage = lazy(() => import('@/features/discovery/DiscoveryFormPage').then((m) => ({ default: m.DiscoveryFormPage })))
const DiscoveryProgressPage = lazy(() => import('@/features/discovery/DiscoveryProgressPage').then((m) => ({ default: m.DiscoveryProgressPage })))
const DeviceSettingsPage = lazy(() => import('@/features/settings/DeviceSettingsPage').then((m) => ({ default: m.DeviceSettingsPage })))
const DeviceSettingsDetailPage = lazy(() => import('@/features/settings/DeviceSettingsDetailPage').then((m) => ({ default: m.DeviceSettingsDetailPage })))
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })))
const DeviceDetailPage = lazy(() => import('@/features/inventory/DeviceDetailPage').then((m) => ({ default: m.DeviceDetailPage })))

function SuspendedRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/inventory" replace />} />

          {/* Settings */}
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/discovery" element={<DiscoveryPage />} />
          <Route path="/discovery/new" element={<DiscoveryFormPage />} />
          <Route path="/discovery/:id/edit" element={<DiscoveryFormPage />} />
          <Route path="/discovery/:id/progress" element={<DiscoveryProgressPage />} />
          <Route path="/discovery/:id/result" element={<DiscoveryResultPage />} />
          <Route path="/discovery/:id" element={<DiscoveryDetailPage />} />
          <Route path="/device-settings" element={<DeviceSettingsPage />} />
          <Route path="/device-settings/:id" element={<DeviceSettingsDetailPage />} />

          {/* Monitoring */}
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/inventory/:id" element={<DeviceDetailPage />} />

          {/* Legacy paths */}
          <Route path="/provisioning" element={<Navigate to="/inventory" replace />} />
          <Route path="/provisioning/:id" element={<Navigate to="/inventory" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<SuspendedRoutes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
