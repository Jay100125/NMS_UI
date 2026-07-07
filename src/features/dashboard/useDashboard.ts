import { useQueries } from '@tanstack/react-query'
import { useJobs } from '@/features/provisioning/useProvisioning'
import { getAvailability } from '@/api/provisioning'
import type { ProvisioningJob, Availability } from '@/lib/types'

export interface JobAvailability { jobId: number; availability: Availability | null }

export function useDashboard() {
  const jobs = useJobs()
  const jobList: ProvisioningJob[] = jobs.data ?? []

  const availabilityQueries = useQueries({
    queries: jobList.map((job) => ({
      queryKey: ['availability', job.id],
      queryFn: () => getAvailability(job.id),
      refetchInterval: 10000,
    })),
  })

  const availabilityByJob: JobAvailability[] = jobList.map((job, i) => ({
    jobId: job.id,
    availability: availabilityQueries[i]?.data ?? null,
  }))

  const totalJobs = jobList.length
  const withAvailability = availabilityByJob.filter((a) => a.availability !== null)
  const devicesUp = withAvailability.filter((a) => a.availability!.is_up).length
  const devicesDown = withAvailability.filter((a) => !a.availability!.is_up).length

  return {
    jobs,
    availabilityByJob,
    isLoading: jobs.isLoading,
    isError: jobs.isError,
    error: jobs.error,
    refetch: jobs.refetch,
    totalJobs,
    devicesUp,
    devicesDown,
  }
}
