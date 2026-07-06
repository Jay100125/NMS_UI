export type SystemType = 'LINUX' | 'SNMP' | 'WINRM'

export interface Credential {
  id: number
  credential_name: string
  system_type: SystemType
  cred_data: string
}

export interface ApiEnvelope<T> {
  'status.code': number
  status: 'success' | 'failure'
  message?: string
  error?: string
  result?: T
}

export interface Discovery { id: number; discovery_profile_name: string; ip: string; port: number; status: 'PENDING'|'RUNNING'|'COMPLETED'|'FAILED'; credential_profile_ids: number[] }
export interface DiscoveryResult { id: number; discovery_id: number; ip: string; port: number; msg: string | null; credential_profile_id: number | null; result: 'COMPLETED'|'FAILED' }
export interface ProvisioningJob { id: number; ip: string; port: number; credential_profile_id?: number; plugin_type?: SystemType; credential_name?: string; system_type?: SystemType }
export interface JobMetric { metric_name: string; polling_interval: number; is_enabled: boolean }
export interface ProvisioningJobDetail { id: number; ip: string; port: number; metrics: JobMetric[] }
export interface PolledData { id: number; job_id: number; metric_type: string; data: Record<string, unknown>; polled_at: string }
export interface Availability { provisioning_job_id: number; is_up: boolean; last_change: string; up_samples: number; total_samples: number; availability_pct: number }
