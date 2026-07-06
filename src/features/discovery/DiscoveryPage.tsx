import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { useDiscoveries } from './useDiscovery'
import { DiscoveryDrawer } from './DiscoveryDrawer'
import type { Discovery } from '@/lib/types'

export function DiscoveryPage() {
  const { data, isLoading, isError, error, refetch } = useDiscoveries()
  const [editing, setEditing] = useState<Discovery | null>(null)
  const [open, setOpen] = useState(false)

  const columns: Column<Discovery>[] = [
    { header: 'Name', cell: (r) => r.discovery_profile_name },
    { header: 'IP', cell: (r) => r.ip },
    { header: 'Port', cell: (r) => r.port },
    { header: 'Status', cell: (r) => <Badge variant="secondary">{r.status}</Badge> },
    { header: '', cell: (r) => (
      <div className="flex gap-2">
        <Link to={`/discovery/${r.id}`} className="text-sm underline">Open</Link>
      </div>
    ) },
  ]

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Discovery</h1>
        <Button onClick={() => { setEditing(null); setOpen(true) }}>New discovery</Button>
      </div>
      {isLoading ? <Loading />
        : isError ? <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        : !data || data.length === 0 ? <EmptyState message="No discovery profiles yet." />
        : <DataTable columns={columns} rows={data} rowKey={(r) => r.id} />}
      <DiscoveryDrawer open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  )
}
