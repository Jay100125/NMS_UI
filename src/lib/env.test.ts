import { apiBase } from './env'

test('apiBase returns a string', () => {
  expect(typeof apiBase()).toBe('string')
})
