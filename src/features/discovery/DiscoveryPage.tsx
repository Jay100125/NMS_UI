import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { useDiscoveries, useDeleteDiscovery } from './useDiscovery'
import type { Discovery } from '@/lib/types'

export function DiscoveryPage() {
  const { data, isLoading, isError, error, refetch } = useDiscoveries()
  const navigate = useNavigate()
  const del = useDeleteDiscovery()

  const columns: Column<Discovery>[] = [
    { header: 'Name', cell: (r) => r.discovery_profile_name },
    { header: 'IP', cell: (r) => r.ip },
    { header: 'Port', cell: (r) => r.port },
    { header: 'Type', cell: (r) => <Badge variant="outline">{r.plugin_type}</Badge> },
    { header: 'Status', cell: (r) => <Badge variant="secondary">{r.status}</Badge> },
    { header: '', cell: (r) => (
      <div className="flex gap-2">
        <Link to={`/discovery/${r.id}`} className="text-sm underline">Open</Link>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/discovery/${r.id}/edit`)}>Edit</Button>
        <Button variant="ghost" size="sm" className="text-red-600"
          onClick={() => { if (confirm(`Delete ${r.discovery_profile_name}?`)) del.mutate(r.id, { onError: (e) => toast.error((e as Error).message) }) }}>Delete</Button>
      </div>
    ) },
  ]

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Discovery</h1>
        <Button onClick={() => navigate('/discovery/new')}>New discovery</Button>
      </div>
      {isLoading ? <Loading />
        : isError ? <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        : !data || data.length === 0 ? <EmptyState message="No discovery profiles yet." />
        : <DataTable columns={columns} rows={data} rowKey={(r) => r.id} />}
    </div>
  )
}
