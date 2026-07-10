import { useParams, Link } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable, type Column } from '@/components/DataTable'
import { Gauge } from '@/components/Gauge'
import { StatTile } from '@/components/StatTile'
import { MetricChart } from '@/components/MetricChart'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { formatBytes, formatDuration } from '@/lib/format'
import { useJobDetail, usePolledData } from '@/features/provisioning/useJobDetail'
import { AvailabilityPanel } from '@/features/provisioning/AvailabilityPanel'
import { PolledDataGrid } from '@/features/provisioning/PolledDataGrid'
import {
  latestHost, latestInstances, num, seriesFor, prettyKey, formatCounter, type InstanceRow,
} from './deviceMetrics'
import type { PolledData } from '@/lib/types'

function ChartCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card p-3">{children}</div>
}

function InstanceTable({ instances, title }: { instances: InstanceRow[]; title: string }) {
  if (instances.length === 0) return null
  const keys = [...new Set(instances.flatMap((i) => Object.keys(i.data)))].filter((k) => k !== 'instance')
  const columns: Column<InstanceRow>[] = [
    { header: 'Instance', cell: (r) => <span className="font-medium">{r.instance}</span> },
    ...keys.map((k): Column<InstanceRow> => ({ header: prettyKey(k), cell: (r) => formatCounter(k, r.data[k]) })),
  ]
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="overflow-x-auto rounded-lg border">
        <DataTable columns={columns} rows={instances} rowKey={(r) => r.instance} />
      </div>
    </div>
  )
}

function bytesStat(data: Record<string, unknown>, key: string, label: string) {
  const v = num(data, key)
  return <StatTile key={key} label={label} value={v == null ? '—' : formatBytes(v)} />
}

function OverviewTab({ rows }: { rows: PolledData[] }) {
  const cpu = latestHost(rows, 'CPU')
  const mem = latestHost(rows, 'MEMORY')
  const disk = latestHost(rows, 'DISK')
  const proc = latestHost(rows, 'PROCESS')
  const up = num(latestHost(rows, 'UPTIME'), 'system_uptime_seconds')

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Gauge label="CPU" value={num(cpu, 'system_cpu_percent')} />
      <Gauge label="Memory" value={num(mem, 'system_memory_used_percent')} />
      <Gauge label="Disk" value={num(disk, 'system_disk_used_percent')} />
      <StatTile label="Cores" value={num(cpu, 'system_cpu_cores') ?? '—'} />
      <StatTile label="Processes" value={num(proc, 'system_process_count')?.toLocaleString() ?? '—'} />
      <StatTile label="Uptime" value={up == null ? '—' : formatDuration(up)} />
    </div>
  )
}

function CpuTab({ rows }: { rows: PolledData[] }) {
  const cpu = latestHost(rows, 'CPU')
  const series = seriesFor(rows, 'CPU', [
    'system_cpu_percent', 'system_cpu_user_percent', 'system_cpu_kernel_percent',
    'system_cpu_idle_percent', 'system_cpu_io_percent',
  ])
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Gauge label="CPU used" value={num(cpu, 'system_cpu_percent')} />
        <StatTile label="Cores" value={num(cpu, 'system_cpu_cores') ?? '—'} />
        <StatTile label="Load 1m" value={num(cpu, 'system_load_avg_1min') ?? '—'} sub={`5m ${num(cpu, 'system_load_avg_5min') ?? '—'} · 15m ${num(cpu, 'system_load_avg_15min') ?? '—'}`} />
      </div>
      {series.length > 0 && <ChartCard><MetricChart title="CPU utilization" series={series} unit="percent" /></ChartCard>}
      <InstanceTable title="Per-core" instances={latestInstances(rows, 'CPU')} />
    </div>
  )
}

function MemoryTab({ rows }: { rows: PolledData[] }) {
  const mem = latestHost(rows, 'MEMORY')
  const series = seriesFor(rows, 'MEMORY', [
    'system_memory_used_bytes', 'system_memory_free_bytes', 'system_memory_available_bytes',
    'system_memory_cached_bytes', 'system_memory_buffer_bytes',
  ])
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Gauge label="Memory used" value={num(mem, 'system_memory_used_percent')} />
        <Gauge label="Swap used" value={num(mem, 'system_swap_used_percent')} />
        {bytesStat(mem, 'system_memory_total_bytes', 'Total')}
        {bytesStat(mem, 'system_memory_used_bytes', 'Used')}
      </div>
      {series.length > 0 && <ChartCard><MetricChart title="Memory" series={series} unit="bytes" /></ChartCard>}
    </div>
  )
}

function DiskTab({ rows }: { rows: PolledData[] }) {
  const disk = latestHost(rows, 'DISK')
  const series = seriesFor(rows, 'DISK', ['system_disk_used_percent'])
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Gauge label="Disk used" value={num(disk, 'system_disk_used_percent')} />
        {bytesStat(disk, 'system_disk_capacity_bytes', 'Capacity')}
        {bytesStat(disk, 'system_disk_used_bytes', 'Used')}
        {bytesStat(disk, 'system_disk_free_bytes', 'Free')}
      </div>
      {series.length > 0 && <ChartCard><MetricChart title="Disk utilization" series={series} unit="percent" /></ChartCard>}
      <InstanceTable title="Volumes" instances={latestInstances(rows, 'DISK')} />
    </div>
  )
}

function NetworkTab({ rows }: { rows: PolledData[] }) {
  const net = latestHost(rows, 'NETWORK')
  const series = seriesFor(rows, 'NETWORK', ['system_network_in_bytes_per_sec', 'system_network_out_bytes_per_sec'])
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="TCP connections" value={num(net, 'system_network_tcp_connections')?.toLocaleString() ?? '—'} />
        <StatTile label="UDP connections" value={num(net, 'system_network_udp_connections')?.toLocaleString() ?? '—'} />
      </div>
      {series.length > 0 && <ChartCard><MetricChart title="Throughput" series={series} unit="bytes_per_sec" /></ChartCard>}
      <InstanceTable title="Interfaces" instances={latestInstances(rows, 'NETWORK')} />
    </div>
  )
}

function ProcessTab({ rows }: { rows: PolledData[] }) {
  const proc = latestHost(rows, 'PROCESS')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total" value={num(proc, 'system_process_count')?.toLocaleString() ?? '—'} />
        <StatTile label="Running" value={num(proc, 'system_running_processes') ?? '—'} />
        <StatTile label="Blocked" value={num(proc, 'system_blocked_processes') ?? '—'} />
      </div>
      <InstanceTable title="Top processes" instances={latestInstances(rows, 'PROCESS')} />
    </div>
  )
}

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'cpu', label: 'CPU' },
  { value: 'memory', label: 'Memory' },
  { value: 'disk', label: 'Disk' },
  { value: 'network', label: 'Network' },
  { value: 'processes', label: 'Processes' },
]

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const deviceId = Number(id)
  const device = useJobDetail(deviceId)
  const polled = usePolledData(deviceId)
  const rows = polled.data ?? []

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link to="/inventory" className="text-sm text-muted-foreground underline">← Back to Inventory</Link>
      </div>

      {device.isLoading ? <Loading />
        : device.isError ? <ErrorState message={(device.error as Error).message} onRetry={() => device.refetch()} />
        : !device.data ? <EmptyState message="Device not found." />
        : (
          <>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold">{device.data.ip}</h1>
                <p className="text-sm text-muted-foreground">{device.data.ip}:{device.data.port}</p>
              </div>
              <Link
                to={`/device-settings/${device.data.id}`}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <SlidersHorizontal className="h-4 w-4" /> Configure
              </Link>
            </div>

            <div className="mb-6">
              <AvailabilityPanel jobId={deviceId} />
            </div>

            {polled.isLoading ? <Loading />
              : rows.length === 0 ? <EmptyState message="No polled data yet." />
              : (
                <Tabs defaultValue="overview">
                  <TabsList className="flex-wrap">
                    {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
                  </TabsList>
                  <TabsContent value="overview"><OverviewTab rows={rows} /></TabsContent>
                  <TabsContent value="cpu"><CpuTab rows={rows} /></TabsContent>
                  <TabsContent value="memory"><MemoryTab rows={rows} /></TabsContent>
                  <TabsContent value="disk"><DiskTab rows={rows} /></TabsContent>
                  <TabsContent value="network"><NetworkTab rows={rows} /></TabsContent>
                  <TabsContent value="processes"><ProcessTab rows={rows} /></TabsContent>
                </Tabs>
              )}

            <div className="mt-6">
              <PolledDataGrid jobId={deviceId} />
            </div>
          </>
        )}
    </div>
  )
}
