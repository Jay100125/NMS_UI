import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AppLayout } from '@/components/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { CredentialsPage } from '@/features/credentials/CredentialsPage'
import { DiscoveryPage } from '@/features/discovery/DiscoveryPage'
import { DiscoveryDetailPage } from '@/features/discovery/DiscoveryDetailPage'
import { ProvisioningPage } from '@/features/provisioning/ProvisioningPage'
import { ProvisioningDetailPage } from '@/features/provisioning/ProvisioningDetailPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/discovery" element={<DiscoveryPage />} />
          <Route path="/discovery/:id" element={<DiscoveryDetailPage />} />
          <Route path="/provisioning" element={<ProvisioningPage />} />
          <Route path="/provisioning/:id" element={<ProvisioningDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
