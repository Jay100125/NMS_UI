import '@testing-library/jest-dom/vitest'
import { server } from './server'
import { beforeAll, afterEach, afterAll } from 'vitest'

// jsdom has no ResizeObserver; Radix components (e.g. Checkbox) require it.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom has no CSS.supports; Highcharts feature-detects with it at load time.
if (typeof globalThis.CSS === 'undefined') {
  // @ts-expect-error - minimal stub, only `supports` is exercised by Highcharts
  globalThis.CSS = { supports: () => false }
} else if (typeof globalThis.CSS.supports !== 'function') {
  globalThis.CSS.supports = () => false
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

