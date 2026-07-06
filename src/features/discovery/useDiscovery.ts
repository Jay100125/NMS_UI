import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as apiD from '@/api/discovery'

const KEY = ['discoveries'] as const

export function useDiscoveries() {
  return useQuery({ queryKey: KEY, queryFn: apiD.listDiscoveries })
}
function useInvalidating<TArgs>(fn: (a: TArgs) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) })
}
export const useCreateDiscovery = () => useInvalidating((v: apiD.DiscoveryInput) => apiD.createDiscovery(v))
export const useUpdateDiscovery = () => useInvalidating((v: { id: number; input: apiD.DiscoveryInput }) => apiD.updateDiscovery(v.id, v.input))
export const useDeleteDiscovery = () => useInvalidating((id: number) => apiD.deleteDiscovery(id))
export const useRunDiscovery = () => useInvalidating((id: number) => apiD.runDiscovery(id))
