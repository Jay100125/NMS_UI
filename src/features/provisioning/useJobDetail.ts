import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getJob, updateJobMetrics, getPolledData, getAvailability } from '@/api/provisioning'
import type { JobMetric } from '@/lib/types'

export function useJobDetail(id: number) {
  return useQuery({ queryKey: ['job', id], queryFn: () => getJob(id) })
}

export function usePolledData(jobId: number) {
  return useQuery({ queryKey: ['polled', jobId], queryFn: () => getPolledData(jobId), refetchInterval: 10000 })
}

export function useAvailability(jobId: number) {
  return useQuery({ queryKey: ['availability', jobId], queryFn: () => getAvailability(jobId), refetchInterval: 10000 })
}

export function useUpdateMetrics(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (metrics: JobMetric[]) => updateJobMetrics(id, metrics),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job', id] }),
  })
}
