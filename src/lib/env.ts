/** Base URL for the API. Empty string in dev so the Vite proxy handles relative /api paths. */
export function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? ''
}
