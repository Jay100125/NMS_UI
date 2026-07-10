import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { SlidersHorizontal, Table2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable, type Column } from '@/components/DataTable'
import { StatTile, pctAccent } from '@/components/StatTile'
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

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: 'all', label: 'All' },
]

function sinceFor(range: string): number {
  const now = Date.now()
  if (range === '24h') return now - 24 * 3600_000
  if (range === '7d') return now - 7 * 86400_000
  if (range === 'all') return 0
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

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

function pctStat(data: Record<string, unknown>, key: string, label: string) {
  const v = num(data, key)
  return <StatTile label={label} value={v == null ? '—' : `${Math.round(v)}%`} accent={pctAccent(v)} />
}

function OverviewTab({ rows, since }: { rows: PolledData[]; since: number }) {
  const cpu = latestHost(rows, 'CPU')
  const mem = latestHost(rows, 'MEMORY')
  const disk = latestHost(rows, 'DISK')
  const proc = latestHost(rows, 'PROCESS')
  const up = num(latestHost(rows, 'UPTIME'), 'system_uptime_seconds')

  const cpuSeries = seriesFor(rows, 'CPU', ['system_cpu_percent'], since)
  const memSeries = seriesFor(rows, 'MEMORY', ['system_memory_used_bytes', 'system_memory_available_bytes'], since)
  const netSeries = seriesFor(rows, 'NETWORK', ['system_network_in_bytes_per_sec', 'system_network_out_bytes_per_sec'], since)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {pctStat(cpu, 'system_cpu_percent', 'CPU')}
        {pctStat(mem, 'system_memory_used_percent', 'Memory')}
        {pctStat(disk, 'system_disk_used_percent', 'Disk')}
        <StatTile label="Cores" value={num(cpu, 'system_cpu_cores') ?? '—'} />
        <StatTile label="Processes" value={num(proc, 'system_process_count')?.toLocaleString() ?? '—'} />
        <StatTile label="Uptime" value={up == null ? '—' : formatDuration(up)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {cpuSeries.length > 0 && <ChartCard><MetricChart title="CPU utilization" series={cpuSeries} unit="percent" /></ChartCard>}
        {memSeries.length > 0 && <ChartCard><MetricChart title="Memory" series={memSeries} unit="bytes" /></ChartCard>}
      </div>

      {netSeries.length > 0 && <ChartCard><MetricChart title="Network throughput" series={netSeries} unit="bytes_per_sec" /></ChartCard>}
    </div>
  )
}

function CpuTab({ rows, since }: { rows: PolledData[]; since: number }) {
  const cpu = latestHost(rows, 'CPU')
  const breakdown = seriesFor(rows, 'CPU', [
    'system_cpu_user_percent', 'system_cpu_kernel_percent', 'system_cpu_io_percent', 'system_cpu_idle_percent',
  ], since)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Cores" value={num(cpu, 'system_cpu_cores') ?? '—'} />
        <StatTile
          label="Load avg"
          value={num(cpu, 'system_load_avg_1min') ?? '—'}
          sub={`5m ${num(cpu, 'system_load_avg_5min') ?? '—'} · 15m ${num(cpu, 'system_load_avg_15min') ?? '—'}`}
        />
      </div>
      {breakdown.length > 0 && <ChartCard><MetricChart title="CPU breakdown" series={breakdown} unit="percent" /></ChartCard>}
      <InstanceTable title="Per-core" instances={latestInstances(rows, 'CPU')} />
    </div>
  )
}

function MemoryTab({ rows }: { rows: PolledData[] }) {
  const mem = latestHost(rows, 'MEMORY')
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {bytesStat(mem, 'system_memory_total_bytes', 'Total')}
      {bytesStat(mem, 'system_memory_used_bytes', 'Used')}
      {bytesStat(mem, 'system_memory_free_bytes', 'Free')}
      {bytesStat(mem, 'system_memory_available_bytes', 'Available')}
      {bytesStat(mem, 'system_memory_cached_bytes', 'Cached')}
      {bytesStat(mem, 'system_memory_buffer_bytes', 'Buffers')}
      {pctStat(mem, 'system_swap_used_percent', 'Swap used')}
      {bytesStat(mem, 'system_swap_total_bytes', 'Swap total')}
    </div>
  )
}

function DiskTab({ rows, since }: { rows: PolledData[]; since: number }) {
  const disk = latestHost(rows, 'DISK')
  const series = seriesFor(rows, 'DISK', ['system_disk_used_percent'], since)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="TCP connections" value={num(net, 'system_network_tcp_connections')?.toLocaleString() ?? '—'} />
        <StatTile label="UDP connections" value={num(net, 'system_network_udp_connections')?.toLocaleString() ?? '—'} />
      </div>
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

  const [showRaw, setShowRaw] = useState(false)
  const [range, setRange] = useState('today')
  const since = sinceFor(range)

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

            {/* Toolbar: chart time range + raw-data toggle (top) */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-md border p-0.5">
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRange(r.value)}
                    className={`rounded px-2.5 py-1 text-xs transition-colors ${
                      range === r.value ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Table2 className="h-4 w-4" /> {showRaw ? 'Hide raw data' : 'Show raw data'}
              </button>
            </div>

            {showRaw && <div className="mb-6"><PolledDataGrid jobId={deviceId} /></div>}

            {polled.isLoading ? <Loading />
              : rows.length === 0 ? <EmptyState message="No polled data yet." />
              : (
                <Tabs defaultValue="overview">
                  <TabsList className="flex-wrap">
                    {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
                  </TabsList>
                  <TabsContent value="overview"><OverviewTab rows={rows} since={since} /></TabsContent>
                  <TabsContent value="cpu"><CpuTab rows={rows} since={since} /></TabsContent>
                  <TabsContent value="memory"><MemoryTab rows={rows} /></TabsContent>
                  <TabsContent value="disk"><DiskTab rows={rows} since={since} /></TabsContent>
                  <TabsContent value="network"><NetworkTab rows={rows} /></TabsContent>
                  <TabsContent value="processes"><ProcessTab rows={rows} /></TabsContent>
                </Tabs>
              )}
          </>
        )}
    </div>
  )
}
