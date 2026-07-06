import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateCredential, useUpdateCredential } from './useCredentials'
import type { Credential, SystemType } from '@/lib/types'

const TYPES: SystemType[] = ['LINUX', 'SNMP', 'WINRM']
const schema = z.object({
  credential_name: z.string().min(1, 'Required'),
  system_type: z.enum(['LINUX', 'SNMP', 'WINRM']),
  user: z.string().min(1, 'Required'),
  password: z.string().min(1, 'Required'),
})
type Form = z.infer<typeof schema>

export function CredentialDrawer({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Credential | null
}) {
  const create = useCreateCredential()
  const update = useUpdateCredential()
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<Form>({ resolver: zodResolver(schema), defaultValues: { system_type: 'LINUX' } })

  // Prefill name/type on edit; never prefill the password (write-only).
  useEffect(() => {
    reset({
      credential_name: editing?.credential_name ?? '',
      system_type: (editing?.system_type as SystemType) ?? 'LINUX',
      user: '',
      password: '',
    })
  }, [editing, open, reset])

  const onSubmit = (v: Form) => {
    const payload = { credential_name: v.credential_name, protocol: v.system_type, cred_data: { user: v.user, password: v.password } }
    const done = { onSuccess: () => { toast.success('Saved'); onOpenChange(false) }, onError: (e: unknown) => toast.error((e as Error).message) }
    if (editing) update.mutate({ id: editing.id, input: payload }, done)
    else create.mutate(payload, done)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader><SheetTitle>{editing ? 'Edit credential' : 'New credential'}</SheetTitle></SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
          <div><Label htmlFor="credential_name">Name</Label><Input id="credential_name" {...register('credential_name')} />
            {errors.credential_name && <p className="text-xs text-red-600">{errors.credential_name.message}</p>}</div>
          <div>
            <Label>Type</Label>
            <Select value={watch('system_type')} onValueChange={(v) => setValue('system_type', v as SystemType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="user">User</Label><Input id="user" {...register('user')} />
            {errors.user && <p className="text-xs text-red-600">{errors.user.message}</p>}</div>
          <div><Label htmlFor="password">Password</Label><Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}</div>
          <Button type="submit" className="w-full" disabled={create.isPending || update.isPending}>Save</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
