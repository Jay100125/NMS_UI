import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loading, ErrorState } from '@/components/states'
import { Link } from 'react-router-dom'
import { useDashboard } from './useDashboard'

export function DashboardPage() {
  const { isLoading, isError, error, refetch, totalJobs, devicesUp, devicesDown } = useDashboard()

  if (isLoading) return <div className="p-6"><Loading /></div>
  if (isError) return <div className="p-6"><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></div>

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Devices</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold" data-testid="total-devices">{totalJobs}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Devices Up</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold" data-testid="devices-up">{devicesUp}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Devices Down</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold" data-testid="devices-down">{devicesDown}</CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link to="/discovery" className="text-sm underline underline-offset-4">Go to Discovery</Link>
        <Link to="/provisioning" className="text-sm underline underline-offset-4">Go to Devices</Link>
      </div>
    </div>
  )
}
