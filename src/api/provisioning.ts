import { api, unwrap } from './client'
import type { ProvisioningJob, ProvisioningJobDetail, JobMetric, PolledData, Availability } from '@/lib/types'

export const listJobs = () => unwrap<ProvisioningJob[]>(api.get('/api/provision'))
export const getJob = async (id: number) => (await unwrap<ProvisioningJobDetail[]>(api.get(`/api/provision/${id}`)))[0]
export const deleteJob = (id: number) => unwrap<unknown[]>(api.delete(`/api/provision/${id}`))
export const provisionFromDiscovery = (discoveryId: number, selected_ips: string[]) =>
  unwrap<unknown[]>(api.post(`/api/provision/${discoveryId}`, { selected_ips }))
export const updateJobMetrics = (id: number, metrics: JobMetric[]) =>
  unwrap<unknown[]>(api.put(`/api/provision/${id}/metrics`, { metrics }))
export const getPolledData = (jobId: number) => unwrap<PolledData[]>(api.get(`/api/polled-data/${jobId}`))
export async function getAvailability(jobId: number): Promise<Availability | null> {
  try {
    return (await unwrap<Availability[]>(api.get(`/api/availability/${jobId}`)))[0] ?? null
  } catch (e: any) {
    if (e?.response?.status === 404) return null   // no samples yet
    throw e
  }
}
