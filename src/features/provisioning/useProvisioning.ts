import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as apiP from '@/api/provisioning'

const KEY = ['jobs'] as const

export function useJobs() {
  return useQuery({ queryKey: KEY, queryFn: apiP.listJobs })
}
function useInvalidating<TArgs>(fn: (a: TArgs) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) })
}
export const useDeleteJob = () => useInvalidating((id: number) => apiP.deleteJob(id))
export const useProvision = () => useInvalidating((v: { discoveryId: number; selectedIps: string[] }) => apiP.provisionFromDiscovery(v.discoveryId, v.selectedIps))
