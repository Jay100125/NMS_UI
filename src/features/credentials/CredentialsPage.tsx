import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { useCredentials } from './useCredentials'
import { CredentialDrawer } from './CredentialDrawer'
import type { Credential } from '@/lib/types'

export function CredentialsPage() {
  const { data, isLoading, isError, error, refetch } = useCredentials()
  const [editing, setEditing] = useState<Credential | null>(null)
  const [open, setOpen] = useState(false)

  const columns: Column<Credential>[] = [
    { header: 'Name', cell: (r) => r.credential_name },
    { header: 'Type', cell: (r) => <Badge variant="secondary">{r.system_type}</Badge> },
    { header: '', cell: (r) => <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setOpen(true) }}>Edit</Button> },
  ]

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Credentials</h1>
        <Button onClick={() => { setEditing(null); setOpen(true) }}>New credential</Button>
      </div>
      {isLoading ? <Loading />
        : isError ? <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        : !data || data.length === 0 ? <EmptyState message="No credentials yet." />
        : <DataTable columns={columns} rows={data} rowKey={(r) => r.id} />}
      <CredentialDrawer open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  )
}
