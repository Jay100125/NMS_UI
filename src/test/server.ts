import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

export const server = setupServer(
  http.post('*/api/login', () => ok(['jwt-test-token'])),
  http.post('*/api/register', () => HttpResponse.json({ 'status.code': 201, status: 'success', result: [{ id: 1 }] })),
  http.get('*/api/credential', () => ok([])),
)
