import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { useDiscoveryDetail, useDiscoveryResults } from './useDiscoveryDetail'
import { useRunDiscovery } from './useDiscovery'
import type { DiscoveryResult } from '@/lib/types'

export function DiscoveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const discoveryId = Number(id)
  const qc = useQueryClient()

  const detail = useDiscoveryDetail(discoveryId)
  const isRunning = detail.data?.status === 'RUNNING'
  const results = useDiscoveryResults(discoveryId, isRunning)
  const run = useRunDiscovery()

  const columns: Column<DiscoveryResult>[] = [
    { header: 'IP', cell: (r) => r.ip },
    { header: 'Port', cell: (r) => r.port },
    { header: 'Result', cell: (r) => <Badge variant="secondary">{r.result}</Badge> },
    { header: 'Message', cell: (r) => r.msg },
  ]

  return (
    <div className="p-6">
      {detail.isLoading ? <Loading />
        : detail.isError ? <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />
        : !detail.data ? <EmptyState message="Discovery profile not found." />
        : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">{detail.data.discovery_profile_name}</h1>
                <p className="text-sm text-muted-foreground">{detail.data.ip}:{detail.data.port}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{detail.data.status}</Badge>
                <Button
                  disabled={isRunning}
                  onClick={() => run.mutate(discoveryId, {
                    onSuccess: () => {
                      toast.success('Discovery run started')
                      qc.invalidateQueries({ queryKey: ['discovery', discoveryId] })
                    },
                    onError: (e) => toast.error((e as Error).message),
                  })}
                >
                  Run
                </Button>
              </div>
            </div>
            {results.isLoading ? <Loading />
              : results.isError ? <ErrorState message={(results.error as Error).message} onRetry={() => results.refetch()} />
              : !results.data || results.data.length === 0 ? <EmptyState message="No results yet." />
              : <DataTable columns={columns} rows={results.data} rowKey={(r) => r.id} />}
          </>
        )}
    </div>
  )
}
