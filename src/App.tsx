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
const DiscoveryFormPage = lazy(() => import('@/features/discovery/DiscoveryFormPage').then((m) => ({ default: m.DiscoveryFormPage })))
const ProvisioningPage = lazy(() => import('@/features/provisioning/ProvisioningPage').then((m) => ({ default: m.ProvisioningPage })))
const ProvisioningDetailPage = lazy(() => import('@/features/provisioning/ProvisioningDetailPage').then((m) => ({ default: m.ProvisioningDetailPage })))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))

function SuspendedRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/discovery" element={<DiscoveryPage />} />
          <Route path="/discovery/new" element={<DiscoveryFormPage />} />
          <Route path="/discovery/:id/edit" element={<DiscoveryFormPage />} />
          <Route path="/discovery/:id" element={<DiscoveryDetailPage />} />
          <Route path="/provisioning" element={<ProvisioningPage />} />
          <Route path="/provisioning/:id" element={<ProvisioningDetailPage />} />
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
