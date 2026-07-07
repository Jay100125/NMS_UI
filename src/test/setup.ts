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

// jsdom has no pointer capture APIs or scrollIntoView; Radix Select (used by
// the credential type picker) calls these during pointer-driven interaction.
if (typeof Element.prototype.hasPointerCapture !== 'function') {
  Element.prototype.hasPointerCapture = () => false
}
if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = () => {}
}
if (typeof Element.prototype.releasePointerCapture !== 'function') {
  Element.prototype.releasePointerCapture = () => {}
}
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {}
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

