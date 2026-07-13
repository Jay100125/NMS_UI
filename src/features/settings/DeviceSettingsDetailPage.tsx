import { useParams, Link } from 'react-router-dom'
import { LineChart } from 'lucide-react'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { useJobDetail } from '@/features/provisioning/useJobDetail'
import { MetricConfigPanel } from '@/features/provisioning/MetricConfigPanel'

export function DeviceSettingsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const deviceId = Number(id)
  const device = useJobDetail(deviceId)

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link to="/device-settings" className="text-sm text-muted-foreground underline">← Back to Device Settings</Link>
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
                to={`/inventory/${device.data.id}`}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <LineChart className="h-4 w-4" /> View polling data
              </Link>
            </div>

            <MetricConfigPanel key={device.data.id} job={device.data} />
          </>
        )}
    </div>
  )
}
