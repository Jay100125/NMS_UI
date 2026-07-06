import { api, unwrap } from './client'
import type { Discovery, DiscoveryResult } from '@/lib/types'

export interface DiscoveryInput {
  discovery_profile_name: string
  ip: string
  port: number
  credential_profile_ids: number[]
}

// Backend write shape uses the dotted `ip.address` key and `credential_profile_id` as an array.
function toWire(input: DiscoveryInput) {
  return {
    discovery_profile_name: input.discovery_profile_name,
    'ip.address': input.ip,
    port: input.port,
    credential_profile_id: input.credential_profile_ids,
  }
}

export const listDiscoveries = () => unwrap<Discovery[]>(api.get('/api/discovery'))
export const getDiscovery = async (id: number) => (await unwrap<Discovery[]>(api.get(`/api/discovery/${id}`)))[0]
export const createDiscovery = (input: DiscoveryInput) => unwrap<unknown[]>(api.post('/api/discovery', toWire(input)))
export const updateDiscovery = (id: number, input: DiscoveryInput) => unwrap<unknown[]>(api.put(`/api/discovery/${id}`, toWire(input)))
export const deleteDiscovery = (id: number) => unwrap<unknown[]>(api.delete(`/api/discovery/${id}`))
export const runDiscovery = (id: number) => unwrap<unknown[]>(api.post(`/api/discovery/${id}/run`, {}))
export const getDiscoveryResults = (id: number) => unwrap<DiscoveryResult[]>(api.get(`/api/discovery/${id}/result`))
