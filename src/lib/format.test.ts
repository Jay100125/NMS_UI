import { formatDateTime, formatPct } from './format'

test('formatPct renders one-decimal percent', () => {
  expect(formatPct(99.5)).toBe('99.5%')
  expect(formatPct(100)).toBe('100.0%')
})

test('formatDateTime returns a non-empty string for a valid ISO date', () => {
  expect(formatDateTime('2026-07-06T10:00:00Z')).not.toBe('')
})
