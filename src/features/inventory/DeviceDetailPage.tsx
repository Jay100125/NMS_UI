import { useParams, Link } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { useJobDetail } from '@/features/provisioning/useJobDetail'
import { MetricCharts } from '@/features/provisioning/MetricCharts'
import { InstanceMetrics } from '@/features/provisioning/InstanceMetrics'
import { PolledDataGrid } from '@/features/provisioning/PolledDataGrid'
import { AvailabilityPanel } from '@/features/provisioning/AvailabilityPanel'

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const deviceId = Number(id)
  const device = useJobDetail(deviceId)

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link to="/inventory" className="text-sm text-muted-foreground underline">← Back to Inventory</Link>
      </div>

      {device.isLoading ? <Loading />
        : device.isError ? <ErrorState message={(device.error as Error).message} onRetry={() => device.refetch()} />
        : !device.data ? <EmptyState message="Device not found." />
        : (
          <>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold">{device.data.ip}</h1>
                <p className="text-sm text-muted-foreground">{device.data.ip}:{device.data.port}</p>
              </div>
              <Link
                to={`/device-settings/${device.data.id}`}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <SlidersHorizontal className="h-4 w-4" /> Configure
              </Link>
            </div>

            <div className="mb-6">
              <AvailabilityPanel jobId={deviceId} />
            </div>

            <div className="mb-6">
              <MetricCharts jobId={deviceId} />
            </div>

            <div className="mb-6">
              <InstanceMetrics jobId={deviceId} />
            </div>

            <div>
              <PolledDataGrid jobId={deviceId} />
            </div>
          </>
        )}
    </div>
  )
}
