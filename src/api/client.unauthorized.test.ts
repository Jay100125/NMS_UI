import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { api, setOnUnauthorized } from './client'

test('401 response invokes onUnauthorized and rejects', async () => {
  const spy = vi.fn()
  setOnUnauthorized(spy)
  server.use(http.get('*/api/credential', () => HttpResponse.json({ 'status.code': 401, status: 'failure', error: 'Unauthorized' }, { status: 401 })))

  await expect(api.get('/api/credential')).rejects.toBeTruthy()
  expect(spy).toHaveBeenCalledTimes(1)

  setOnUnauthorized(() => {})
})
