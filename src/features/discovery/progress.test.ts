import { describe, it, expect } from 'vitest'
import { initialProgress, reduceProgress, seedFromResults, summarize } from './progress'
import type { DiscoveryResult } from '@/lib/types'

const apply = (events: unknown[]) => events.reduce(reduceProgress, initialProgress)

describe('reduceProgress', () => {
  it('walks an IP through ping → port → plugin success', () => {
    const s = apply([
      { type: 'state', status: 'RUNNING' },
      { type: 'targets', total: 2, ips: ['10.0.0.1', '10.0.0.2'] },
      { type: 'progress', ip: '10.0.0.1', stage: 'PING', progress: 33.33, status: 'ok' },
      { type: 'progress', ip: '10.0.0.1', stage: 'PORT', progress: 66.66, status: 'ok' },
      { type: 'progress', ip: '10.0.0.1', stage: 'PLUGIN', progress: 100, status: 'COMPLETED', message: 'Discovery succeeded' },
    ])
    expect(s.runState).toBe('RUNNING')
    expect(s.rows['10.0.0.1']).toMatchObject({ stage: 'PLUGIN', progress: 100, status: 'completed' })
    expect(s.rows['10.0.0.2']).toMatchObject({ status: 'pending', progress: 0 })
    expect(summarize(s)).toEqual({ total: 2, discovered: 1, failed: 0, overallPct: 50 })
  })

  it('marks ping/port failures failed at 100', () => {
    const s = apply([
      { type: 'targets', total: 1, ips: ['10.0.0.9'] },
      { type: 'progress', ip: '10.0.0.9', stage: 'PING', progress: 100, status: 'failed', message: 'ping failed' },
    ])
    expect(s.rows['10.0.0.9']).toMatchObject({ status: 'failed', message: 'ping failed' })
    expect(summarize(s)).toEqual({ total: 1, discovered: 0, failed: 1, overallPct: 100 })
  })

  it('does not downgrade a completed IP when another credential fails', () => {
    const s = apply([
      { type: 'targets', total: 1, ips: ['10.0.0.5'] },
      { type: 'progress', ip: '10.0.0.5', stage: 'PLUGIN', progress: 100, status: 'COMPLETED' },
      { type: 'progress', ip: '10.0.0.5', stage: 'PLUGIN', progress: 100, status: 'FAILED', message: 'auth failed' },
    ])
    expect(s.rows['10.0.0.5'].status).toBe('completed')
  })

  it('records completion state', () => {
    const s = apply([{ type: 'state', status: 'COMPLETED' }])
    expect(s.runState).toBe('COMPLETED')
  })

  it('ignores malformed events', () => {
    expect(apply([null, 42, { type: 'bogus' }])).toEqual(initialProgress)
  })
})

describe('seedFromResults', () => {
  it('rebuilds terminal rows from persisted results', () => {
    const results = [
      { id: 1, discovery_id: 3, ip: '10.0.0.1', port: 22, msg: 'ok', credential_profile_id: 1, result: 'COMPLETED' },
      { id: 2, discovery_id: 3, ip: '10.0.0.2', port: 22, msg: 'Device unreachable', credential_profile_id: null, result: 'FAILED' },
    ] as DiscoveryResult[]
    const s = seedFromResults(initialProgress, results, 'RUNNING')
    expect(s.runState).toBe('RUNNING')
    expect(s.rows['10.0.0.1'].status).toBe('completed')
    expect(s.rows['10.0.0.2']).toMatchObject({ status: 'failed', message: 'Device unreachable' })
  })
})
