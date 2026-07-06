import { useQuery } from '@tanstack/react-query'
import { getDiscovery, getDiscoveryResults } from '@/api/discovery'

export function useDiscoveryDetail(id: number) {
  return useQuery({ queryKey: ['discovery', id], queryFn: () => getDiscovery(id) })
}

export function useDiscoveryResults(id: number, isRunning: boolean) {
  return useQuery({
    queryKey: ['discovery-results', id],
    queryFn: () => getDiscoveryResults(id),
    refetchInterval: isRunning ? 3000 : false,
  })
}
