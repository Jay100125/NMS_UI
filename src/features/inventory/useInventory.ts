import { useQueries } from '@tanstack/react-query'
import { useJobs } from '@/features/provisioning/useProvisioning'
import { getAvailability } from '@/api/provisioning'
import type { ProvisioningJob, Availability } from '@/lib/types'

export interface InventoryDevice extends ProvisioningJob {
  availability: Availability | null
}

/**
 * The set of provisioned devices, each enriched with its latest availability
 * (up/down + uptime %). Availability is polled per-device on a 10s interval so
 * the Inventory list reflects live state.
 */
export function useInventory() {
  const jobs = useJobs()
  const jobList: ProvisioningJob[] = jobs.data ?? []

  const availabilityQueries = useQueries({
    queries: jobList.map((job) => ({
      queryKey: ['availability', job.id],
      queryFn: () => getAvailability(job.id),
      refetchInterval: 10000,
    })),
  })

  const devices: InventoryDevice[] = jobList.map((job, i) => ({
    ...job,
    availability: availabilityQueries[i]?.data ?? null,
  }))

  return {
    devices,
    isLoading: jobs.isLoading,
    isError: jobs.isError,
    error: jobs.error,
    refetch: jobs.refetch,
  }
}
