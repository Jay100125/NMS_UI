import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { useDiscoveryDetail, useDiscoveryResults } from './useDiscoveryDetail'
import { useProvision } from '@/features/provisioning/useProvisioning'
import type { DiscoveryResult } from '@/lib/types'

export function DiscoveryResultPage() {
  const { id } = useParams<{ id: string }>()
  const discoveryId = Number(id)
  const navigate = useNavigate()

  const detail = useDiscoveryDetail(discoveryId)
  const results = useDiscoveryResults(discoveryId, detail.data?.status === 'RUNNING')
  const provision = useProvision()
  const [selectedIps, setSelectedIps] = useState<Set<string>>(new Set())

  const toggleIp = (ip: string, checked: boolean) => {
    setSelectedIps((prev) => {
      const next = new Set(prev)
      if (checked) next.add(ip)
      else next.delete(ip)
      return next
    })
  }

  const columns: Column<DiscoveryResult>[] = [
    {
      header: '',
      cell: (r) => r.result === 'COMPLETED'
        ? (
          <Checkbox
            checked={selectedIps.has(r.ip)}
            onCheckedChange={(checked) => toggleIp(r.ip, checked === true)}
          />
          )
        : null,
    },
    { header: 'IP', cell: (r) => r.ip },
    { header: 'Port', cell: (r) => r.port },
    { header: 'Result', cell: (r) => <Badge variant="secondary">{r.result}</Badge> },
    { header: 'Message', cell: (r) => r.msg },
  ]

  const handleProvision = () => {
    provision.mutate({ discoveryId, selectedIps: Array.from(selectedIps) }, {
      onSuccess: () => {
        toast.success('Provisioning started')
        navigate('/provisioning')
      },
      onError: (e) => toast.error((e as Error).message),
    })
  }

  return (
    <div className="p-6">
      {detail.isLoading ? <Loading />
        : detail.isError ? <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />
        : !detail.data ? <EmptyState message="Discovery profile not found." />
        : (
          <>
            <div className="mb-4">
              <h1 className="text-xl font-semibold">{detail.data.discovery_profile_name}</h1>
              <Link to={`/discovery/${discoveryId}`} className="text-sm text-muted-foreground underline">
                Back to profile
              </Link>
            </div>
            {results.isLoading ? <Loading />
              : results.isError ? <ErrorState message={(results.error as Error).message} onRetry={() => results.refetch()} />
              : !results.data || results.data.length === 0 ? <EmptyState message="No results yet." />
              : (
                <>
                  <DataTable columns={columns} rows={results.data} rowKey={(r) => r.id} />
                  <div className="mt-4">
                    <Button disabled={selectedIps.size === 0} onClick={handleProvision}>
                      Provision selected
                    </Button>
                  </div>
                </>
                )}
          </>
        )}
    </div>
  )
}
