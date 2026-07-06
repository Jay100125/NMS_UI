import axios, { type AxiosResponse } from 'axios'
import { apiBase } from '@/lib/env'
import type { ApiEnvelope } from '@/lib/types'

let tokenGetter: () => string | null = () => null
let onUnauthorized: () => void = () => {}

export function setAuthTokenGetter(fn: () => string | null) { tokenGetter = fn }
export function setOnUnauthorized(fn: () => void) { onUnauthorized = fn }

export const api = axios.create({ baseURL: apiBase() })

api.interceptors.request.use((config) => {
  const token = tokenGetter()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) onUnauthorized()
    return Promise.reject(error)
  },
)

/** Unwraps the backend envelope: resolves result on success, throws error text on failure. */
export async function unwrap<T>(p: Promise<AxiosResponse<ApiEnvelope<T>>>): Promise<T> {
  const res = await p
  const body = res.data
  if (body.status === 'failure') throw new Error(body.error ?? 'Request failed')
  return body.result as T
}
