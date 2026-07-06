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
