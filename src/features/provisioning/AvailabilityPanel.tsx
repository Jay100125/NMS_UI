import { Badge } from '@/components/ui/badge'
import { Loading, ErrorState } from '@/components/states'
import { formatPct } from '@/lib/format'
import { useAvailability } from './useJobDetail'

export function AvailabilityPanel({ jobId }: { jobId: number }) {
  const availability = useAvailability(jobId)

  if (availability.isLoading) return <Loading />

  // getAvailability already swallows 404s into `null` ("no samples yet"), so a
  // genuine isError here means a real query failure, not the empty-data case.
  if (availability.isError) {
    return <ErrorState message={(availability.error as Error).message} onRetry={() => availability.refetch()} />
  }

  if (availability.data === null || availability.data === undefined) {
    return (
      <div className="rounded-md border p-4">
        <h2 className="mb-3 text-lg font-semibold">Availability</h2>
        <p className="text-sm text-muted-foreground">No availability data yet</p>
      </div>
    )
  }

  const { is_up, availability_pct, up_samples, total_samples } = availability.data

  return (
    <div className="rounded-md border p-4">
      <h2 className="mb-3 text-lg font-semibold">Availability</h2>
      <div className="flex items-center gap-3">
        <Badge variant={is_up ? 'success' : 'destructive'}>{is_up ? 'Up' : 'Down'}</Badge>
        <span className="text-sm font-medium">{formatPct(availability_pct)}</span>
        <span className="text-xs text-muted-foreground">{up_samples}/{total_samples} samples up</span>
      </div>
    </div>
  )
}
