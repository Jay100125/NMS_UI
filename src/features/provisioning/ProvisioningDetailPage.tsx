import { useParams } from 'react-router-dom'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { useJobDetail } from './useJobDetail'
import { MetricConfigPanel } from './MetricConfigPanel'
import { MetricCharts } from './MetricCharts'
import { AvailabilityPanel } from './AvailabilityPanel'

export function ProvisioningDetailPage() {
  const { id } = useParams<{ id: string }>()
  const jobId = Number(id)
  const job = useJobDetail(jobId)

  return (
    <div className="p-6">
      {job.isLoading ? <Loading />
        : job.isError ? <ErrorState message={(job.error as Error).message} onRetry={() => job.refetch()} />
        : !job.data ? <EmptyState message="Provisioning job not found." />
        : (
          <>
            <div className="mb-4">
              <h1 className="text-xl font-semibold">Provisioning job #{job.data.id}</h1>
              <p className="text-sm text-muted-foreground">{job.data.ip}:{job.data.port}</p>
            </div>

            <MetricConfigPanel key={job.data.id} job={job.data} />

            <div className="mt-6">
              <MetricCharts jobId={jobId} />
            </div>

            <div className="mt-6">
              <AvailabilityPanel jobId={jobId} />
            </div>
          </>
        )}
    </div>
  )
}
