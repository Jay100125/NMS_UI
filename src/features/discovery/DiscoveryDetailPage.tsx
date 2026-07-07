import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { useDiscoveryDetail } from './useDiscoveryDetail'
import { useRunDiscovery } from './useDiscovery'

export function DiscoveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const discoveryId = Number(id)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const detail = useDiscoveryDetail(discoveryId)
  const isRunning = detail.data?.status === 'RUNNING'
  const run = useRunDiscovery()

  return (
    <div className="p-6">
      {detail.isLoading ? <Loading />
        : detail.isError ? <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />
        : !detail.data ? <EmptyState message="Discovery profile not found." />
        : (
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{detail.data.discovery_profile_name}</h1>
              <p className="text-sm text-muted-foreground">{detail.data.ip}:{detail.data.port}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{detail.data.status}</Badge>
              <Badge variant="outline">{detail.data.plugin_type}</Badge>
              <Button variant="outline" onClick={() => navigate(`/discovery/${discoveryId}/edit`)}>Edit</Button>
              <Button variant="outline" onClick={() => navigate(`/discovery/${discoveryId}/result`)}>Results</Button>
              <Button
                disabled={isRunning}
                onClick={() => run.mutate(discoveryId, {
                  onSuccess: () => {
                    qc.invalidateQueries({ queryKey: ['discovery', discoveryId] })
                    navigate(`/discovery/${discoveryId}/progress`)
                  },
                  onError: (e) => toast.error((e as Error).message),
                })}
              >
                Run
              </Button>
            </div>
          </div>
        )}
    </div>
  )
}
