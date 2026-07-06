import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient(retry = true) {
  return new QueryClient({ defaultOptions: { queries: { retry: retry ? 1 : false } } })
}
