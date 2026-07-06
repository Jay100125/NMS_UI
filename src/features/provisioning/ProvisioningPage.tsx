import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { useJobs, useDeleteJob } from './useProvisioning'
import type { ProvisioningJob } from '@/lib/types'

export function ProvisioningPage() {
  const { data, isLoading, isError, error, refetch } = useJobs()
  const del = useDeleteJob()

  const columns: Column<ProvisioningJob>[] = [
    { header: 'IP', cell: (r) => r.ip },
    { header: 'Port', cell: (r) => r.port },
    { header: 'Credential', cell: (r) => r.credential_name },
    { header: 'Type', cell: (r) => <Badge variant="secondary">{r.system_type}</Badge> },
    { header: '', cell: (r) => (
      <div className="flex gap-2">
        <Link to={`/provisioning/${r.id}`} className="text-sm underline">Open</Link>
        <Button variant="ghost" size="sm" className="text-red-600"
          onClick={() => { if (confirm(`Delete job for ${r.ip}?`)) del.mutate(r.id, { onError: (e) => toast.error((e as Error).message) }) }}>Delete</Button>
      </div>
    ) },
  ]

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Provisioning</h1>
      </div>
      {isLoading ? <Loading />
        : isError ? <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        : !data || data.length === 0 ? <EmptyState message="No provisioning jobs yet." />
        : <DataTable columns={columns} rows={data} rowKey={(r) => r.id} />}
    </div>
  )
}
