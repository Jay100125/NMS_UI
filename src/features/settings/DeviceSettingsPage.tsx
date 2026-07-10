import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { useJobs, useDeleteJob } from '@/features/provisioning/useProvisioning'
import type { ProvisioningJob } from '@/lib/types'

export function DeviceSettingsPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useJobs()
  const del = useDeleteJob()

  const columns: Column<ProvisioningJob>[] = [
    { header: 'IP', cell: (r) => <span className="font-medium">{r.ip}</span> },
    { header: 'Port', cell: (r) => r.port },
    { header: 'Credential', cell: (r) => r.credential_name ?? '—' },
    { header: 'Type', cell: (r) => <Badge variant="secondary">{r.system_type ?? r.plugin_type}</Badge> },
    { header: '', cell: (r) => (
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate(`/device-settings/${r.id}`)}>Configure</Button>
        <Button
          variant="ghost" size="sm" className="text-red-600"
          onClick={() => { if (confirm(`Remove device ${r.ip}?`)) del.mutate(r.id, { onError: (e) => toast.error((e as Error).message) }) }}
        >
          Delete
        </Button>
      </div>
    ) },
  ]

  return (
    <div className="p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Device Settings</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Configure which metrics are polled and how often, or remove a device.</p>

      {isLoading ? <Loading />
        : isError ? <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        : !data || data.length === 0 ? <EmptyState message="No devices provisioned yet." />
        : <DataTable columns={columns} rows={data} rowKey={(r) => r.id} />}
    </div>
  )
}
