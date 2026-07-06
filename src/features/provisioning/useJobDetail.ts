import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getJob, updateJobMetrics } from '@/api/provisioning'
import type { JobMetric } from '@/lib/types'

export function useJobDetail(id: number) {
  return useQuery({ queryKey: ['job', id], queryFn: () => getJob(id) })
}

export function useUpdateMetrics(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (metrics: JobMetric[]) => updateJobMetrics(id, metrics),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job', id] }),
  })
}
