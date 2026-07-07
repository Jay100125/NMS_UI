import { describe, it, expect, vi, beforeEach } from 'vitest'

// NOTE: vi.mock factories are hoisted above the file's top-level statements, so a
// plain `class MockBus {}` declared below would be in its TDZ when the (hoisted)
// vi.mock factory runs, throwing "Cannot access 'MockBus' before initialization".
// vi.hoisted() lifts this declaration alongside the mocks so it's initialized first.
const { MockBus, instances } = vi.hoisted(() => {
  class MockBus {
    onopen: (() => void) | null = null
    onclose: (() => void) | null = null
    handlers = new Map<string, (err: null, msg: { body: unknown }) => void>()
    url: string
    constructor(url: string) { this.url = url; instances.push(this) }
    enableReconnect = vi.fn()
    registerHandler(address: string, cb: (err: null, msg: { body: unknown }) => void) { this.handlers.set(address, cb) }
    unregisterHandler(address: string) { this.handlers.delete(address) }
    close = vi.fn()
  }
  const instances: InstanceType<typeof MockBus>[] = []
  return { MockBus, instances }
})
type MockBus = InstanceType<typeof MockBus>

vi.mock('@vertx/eventbus-bridge-client.js', () => ({ default: MockBus }))
vi.mock('@/stores/auth', () => ({ useAuthStore: { getState: () => ({ token: 'jwt-token' }) } }))

import { subscribe, _resetForTests } from './eventbus'

describe('eventbus', () => {
  beforeEach(() => { instances.length = 0; _resetForTests() })

  it('connects lazily with the token, delivers bodies, and closes when empty', () => {
    const got: unknown[] = []
    const unsub = subscribe('nms.discovery.7', (body) => got.push(body))

    expect(instances).toHaveLength(1)
    expect(instances[0].url).toContain('/eventbus?access_token=jwt-token')

    instances[0].onopen?.()
    instances[0].handlers.get('nms.discovery.7')?.(null, { body: { type: 'state', status: 'RUNNING' } })
    expect(got).toEqual([{ type: 'state', status: 'RUNNING' }])

    unsub()
    expect(instances[0].close).toHaveBeenCalled()
  })

  it('reports connection status transitions', () => {
    const statuses: boolean[] = []
    subscribe('nms.discovery.9', () => {}, (up) => statuses.push(up))
    instances[0].onopen?.()
    instances[0].onclose?.()
    expect(statuses).toEqual([true, false])
  })
})
