import { create } from 'zustand'
import { setAuthTokenGetter, setOnUnauthorized } from '@/api/client'

const KEY = 'nms.auth'

interface Persisted { token: string | null; username: string | null }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : { token: null, username: null }
  } catch {
    return { token: null, username: null }
  }
}

interface AuthState extends Persisted {
  setSession: (token: string, username: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  ...load(),
  setSession: (token, username) => {
    localStorage.setItem(KEY, JSON.stringify({ token, username }))
    set({ token, username })
  },
  logout: () => {
    localStorage.removeItem(KEY)
    set({ token: null, username: null })
  },
}))

export const isAuthenticated = (s: Pick<AuthState, 'token'>) => Boolean(s.token)

// Wire the store into the api client (token read + 401 handling).
setAuthTokenGetter(() => useAuthStore.getState().token)
setOnUnauthorized(() => useAuthStore.getState().logout())
