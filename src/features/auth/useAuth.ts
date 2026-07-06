import { useMutation } from '@tanstack/react-query'
import { login, register } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: (v: { username: string; password: string }) => login(v.username, v.password),
    onSuccess: (token, v) => setSession(token, v.username),
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (v: { username: string; password: string }) => register(v.username, v.password),
  })
}
