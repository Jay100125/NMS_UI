import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { formatPct } from '@/lib/format'
import { useDashboard } from './useDashboard'
import type { ProvisioningJob, Availability } from '@/lib/types'

interface JobRow extends ProvisioningJob {
  availability: Availability | null
}

export function DashboardPage() {
  const { jobs, availabilityByJob, isLoading, isError, error, refetch, totalJobs, devicesUp, devicesDown, avgUptimePct } = useDashboard()

  const data = jobs.data ?? []
  const rows: JobRow[] = data.map((job) => ({
    ...job,
    availability: availabilityByJob.find((a) => a.jobId === job.id)?.availability ?? null,
  }))

  const columns: Column<JobRow>[] = [
    { header: 'IP', cell: (r) => r.ip },
    { header: 'Status', cell: (r) => r.availability
      ? <Badge variant={r.availability.is_up ? 'default' : 'destructive'}>{r.availability.is_up ? 'Up' : 'Down'}</Badge>
      : <span className="text-sm text-muted-foreground">—</span> },
    { header: 'Uptime', cell: (r) => r.availability ? formatPct(r.availability.availability_pct) : '—' },
  ]

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Jobs</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{totalJobs}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Devices Up</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{devicesUp}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Devices Down</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{devicesDown}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Uptime</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold" data-testid="avg-uptime">{formatPct(avgUptimePct)}</CardContent>
        </Card>
      </div>

      {isLoading ? <Loading />
        : isError ? <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        : rows.length === 0 ? <EmptyState message="No provisioned devices yet." />
        : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />}
    </div>
  )
}
