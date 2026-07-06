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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

