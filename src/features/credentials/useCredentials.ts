import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listCredentials, createCredential, updateCredential, deleteCredential, type CredentialInput } from '@/api/credentials'

const KEY = ['credentials'] as const

export function useCredentials() {
  return useQuery({ queryKey: KEY, queryFn: listCredentials })
}

export function useCreateCredential() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (i: CredentialInput) => createCredential(i), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) })
}

export function useUpdateCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: number; input: Partial<CredentialInput> }) => updateCredential(v.id, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteCredential() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: number) => deleteCredential(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) })
}
