declare module '@vertx/eventbus-bridge-client.js' {
  interface EventBusMessage { body: unknown }
  export default class EventBus {
    constructor(url: string, options?: Record<string, unknown>)
    onopen: (() => void) | null
    onclose: (() => void) | null
    enableReconnect(enable: boolean): void
    registerHandler(address: string, callback: (err: Error | null, message: EventBusMessage) => void): void
    unregisterHandler(address: string, callback: (err: Error | null, message: EventBusMessage) => void): void
    close(): void
  }
}
