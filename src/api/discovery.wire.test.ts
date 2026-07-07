import { describe, it, expect, vi } from 'vitest'
import { api } from './client'
import { createDiscovery } from './discovery'

describe('discovery wire format', () => {
  it('sends dotted ip.address, credential_profile_id array, and plugin_type', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { status: 'success', result: [1] } } as never)
    await createDiscovery({ discovery_profile_name: 'd', ip: '10.0.0.0/24', port: 161, credential_profile_ids: [3], plugin_type: 'SNMP' })
    expect(post).toHaveBeenCalledWith('/api/discovery', {
      discovery_profile_name: 'd',
      'ip.address': '10.0.0.0/24',
      port: 161,
      credential_profile_id: [3],
      plugin_type: 'SNMP',
    })
    post.mockRestore()
  })
})
