import { api, unwrap } from './client'

export async function login(username: string, password: string): Promise<string> {
  const result = await unwrap<string[]>(api.post('/api/login', { username, password }))
  return result[0]
}

export async function register(username: string, password: string): Promise<void> {
  await unwrap<unknown[]>(api.post('/api/register', { username, password }))
}
