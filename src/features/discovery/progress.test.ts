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

  it('does not un-fail a failed IP on a later non-terminal event (e.g. a stray PING)', () => {
    const s = apply([
      { type: 'targets', total: 1, ips: ['10.0.0.6'] },
      { type: 'progress', ip: '10.0.0.6', stage: 'PING', progress: 33.33, status: 'failed', message: 'ping failed' },
      { type: 'progress', ip: '10.0.0.6', stage: 'PING', progress: 33.33, status: 'ok' },
    ])
    expect(s.rows['10.0.0.6']).toMatchObject({ status: 'failed', message: 'ping failed' })
  })

  it('does allow a failed IP to be upgraded to completed by a later credential', () => {
    const s = apply([
      { type: 'targets', total: 1, ips: ['10.0.0.7'] },
      { type: 'progress', ip: '10.0.0.7', stage: 'PLUGIN', progress: 100, status: 'FAILED', message: 'auth failed (cred A)' },
      { type: 'progress', ip: '10.0.0.7', stage: 'PLUGIN', progress: 100, status: 'COMPLETED' },
    ])
    expect(s.rows['10.0.0.7']).toMatchObject({ status: 'completed' })
  })

  it('records completion state', () => {
    const s = apply([{ type: 'state', status: 'COMPLETED' }])
    expect(s.runState).toBe('COMPLETED')
  })

  it('ignores malformed events', () => {
    expect(apply([null, 42, { type: 'bogus' }])).toEqual(initialProgress)
  })

  it('ignores a state event with an unrecognized status', () => {
    const s = apply([{ type: 'state', status: 'PENDING' }])
    expect(s).toEqual(initialProgress)
  })

  it('ignores a progress event with a non-finite progress value', () => {
    const s = apply([
      { type: 'targets', total: 1, ips: ['10.0.0.1'] },
      { type: 'progress', ip: '10.0.0.1', stage: 'PING', progress: NaN, status: 'ok' },
    ])
    expect(s.rows['10.0.0.1']).toMatchObject({ stage: null, progress: 0, status: 'pending' })
  })

  it('skips non-string ips in a targets event', () => {
    const s = apply([{ type: 'targets', total: 3, ips: ['10.0.0.1', 42, null] }])
    expect(Object.keys(s.rows)).toEqual(['10.0.0.1'])
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
