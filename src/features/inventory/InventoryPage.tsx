import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { formatPct } from '@/lib/format'
import { useInventory, type InventoryDevice } from './useInventory'

function StatusBadge({ device }: { device: InventoryDevice }) {
  if (!device.availability) return <Badge variant="secondary">Unknown</Badge>
  return device.availability.is_up
    ? <Badge variant="success">Up</Badge>
    : <Badge variant="destructive">Down</Badge>
}

export function InventoryPage() {
  const navigate = useNavigate()
  const { devices, isLoading, isError, error, refetch } = useInventory()

  const columns: Column<InventoryDevice>[] = [
    { header: 'IP', cell: (r) => <span className="font-medium">{r.ip}</span> },
    { header: 'Port', cell: (r) => r.port },
    { header: 'Type', cell: (r) => <Badge variant="secondary">{r.system_type ?? r.plugin_type}</Badge> },
    { header: 'Status', cell: (r) => <StatusBadge device={r} /> },
    { header: 'Availability', cell: (r) => r.availability ? formatPct(r.availability.availability_pct) : '—' },
  ]

  return (
    <div className="p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inventory</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Provisioned devices. Select a device to view its polling data.</p>

      {isLoading ? <Loading />
        : isError ? <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        : devices.length === 0 ? <EmptyState message="No devices provisioned yet. Run a discovery and provision its results." />
        : (
          <DataTable
            columns={columns}
            rows={devices}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/inventory/${r.id}`)}
          />
        )}
    </div>
  )
}
