import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useUpdateMetrics } from './useJobDetail'
import type { JobMetric, ProvisioningJobDetail } from '@/lib/types'

export function MetricConfigPanel({ job }: { job: ProvisioningJobDetail }) {
  const [metrics, setMetrics] = useState<JobMetric[]>(job.metrics)
  const update = useUpdateMetrics(job.id)

  const setEnabled = (index: number, is_enabled: boolean) => {
    setMetrics((prev) => prev.map((m, i) => (i === index ? { ...m, is_enabled } : m)))
  }

  const setInterval = (index: number, polling_interval: number) => {
    setMetrics((prev) => prev.map((m, i) => (i === index ? { ...m, polling_interval } : m)))
  }

  const handleSave = () => {
    update.mutate(metrics, {
      onSuccess: () => toast.success('Metric configuration saved'),
      onError: (e) => toast.error((e as Error).message),
    })
  }

  return (
    <div className="rounded-md border p-4">
      <h2 className="mb-3 text-lg font-semibold">Metric configuration</h2>
      <div className="space-y-3">
        {metrics.map((m, i) => (
          <div key={m.metric_name} className="flex items-center gap-4">
            <Switch
              checked={m.is_enabled}
              onCheckedChange={(checked) => setEnabled(i, checked)}
              aria-label={`Enable ${m.metric_name}`}
            />
            <span className="w-32 text-sm">{m.metric_name}</span>
            <Input
              type="number"
              className="w-24"
              value={m.polling_interval}
              onChange={(e) => setInterval(i, Number(e.target.value))}
              aria-label={`${m.metric_name} polling interval`}
            />
            <span className="text-xs text-muted-foreground">seconds</span>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Button disabled={update.isPending} onClick={handleSave}>Save</Button>
      </div>
    </div>
  )
}
