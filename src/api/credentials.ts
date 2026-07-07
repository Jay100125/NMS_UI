import { api, unwrap } from './client'
import type { Credential, SystemType } from '@/lib/types'

export interface CredDataInput { user?: string; password?: string; community?: string }

export interface CredentialInput {
  credential_name: string
  protocol: SystemType
  cred_data: CredDataInput
}

export type CredentialUpdateInput = Omit<CredentialInput, 'cred_data'> & { cred_data?: CredDataInput }

export const listCredentials = () => unwrap<Credential[]>(api.get('/api/credential'))
export const createCredential = (input: CredentialInput) => unwrap<unknown[]>(api.post('/api/credential', input))
export const updateCredential = (id: number, input: CredentialUpdateInput) =>
  unwrap<unknown[]>(api.patch(`/api/credential/${id}`, input))
export const deleteCredential = (id: number) => unwrap<unknown[]>(api.delete(`/api/credential/${id}`))
