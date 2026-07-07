import EventBus from '@vertx/eventbus-bridge-client.js'
import { useAuthStore } from '@/stores/auth'
import { apiBase } from '@/lib/env'

type Handler = (body: unknown) => void
type StatusHandler = (connected: boolean) => void

interface Subscription { address: string; onMessage: Handler; onStatus?: StatusHandler; cb: (err: Error | null, msg: { body: unknown }) => void }

let bus: EventBus | null = null
let connected = false
const subscriptions = new Set<Subscription>()

function ensureBus(): EventBus {
  if (bus) return bus
  const token = useAuthStore.getState().token ?? ''
  bus = new EventBus(`${apiBase()}/eventbus?access_token=${encodeURIComponent(token)}`, { vertxbus_ping_interval: 5000 })
  bus.enableReconnect(true)
  bus.onopen = () => {
    connected = true
    // (Re)register all handlers — the bridge drops them on reconnect.
    for (const s of subscriptions) bus!.registerHandler(s.address, s.cb)
    for (const s of subscriptions) s.onStatus?.(true)
  }
  bus.onclose = () => {
    connected = false
    for (const s of subscriptions) s.onStatus?.(false)
  }
  return bus
}

/**
 * Subscribes to an event-bus address over the shared SockJS bridge connection.
 * The connection opens on first subscribe and closes when the last subscriber
 * unsubscribes. Message handlers receive the JSON body only.
 */
export function subscribe(address: string, onMessage: Handler, onStatus?: StatusHandler): () => void {
  const cb = (_err: Error | null, msg: { body: unknown }) => onMessage(msg.body)
  const sub: Subscription = { address, onMessage, onStatus, cb }
  subscriptions.add(sub)
  const b = ensureBus()
  if (connected) {
    b.registerHandler(address, cb)
    onStatus?.(true)
  }
  return () => {
    subscriptions.delete(sub)
    try { b.unregisterHandler(address, cb) } catch { /* bridge may already be closed */ }
    if (subscriptions.size === 0) {
      b.close()
      bus = null
      connected = false
    }
  }
}

/** Test hook: drop the singleton so each test starts from a cold connection. */
export function _resetForTests() {
  bus = null
  connected = false
  subscriptions.clear()
}
