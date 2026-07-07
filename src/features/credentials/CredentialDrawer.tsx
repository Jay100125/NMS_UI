import { useEffect, useRef } from 'react'
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

// On create, user/password (or, for SNMP, community) are required. On edit,
// they may be left blank to keep the existing cred_data (password is
// write-only and never prefilled). If exactly one of user/password is filled
// on edit, that's invalid — changing credentials is all-or-nothing so we
// never overwrite one half with ''.
function makeSchema(isEditing: boolean, systemType: SystemType) {
  const base = z.object({
    credential_name: z.string().min(1, 'Name is required'),
    system_type: z.enum(['LINUX', 'SNMP', 'WINRM']),
    user: z.string(),
    password: z.string(),
    community: z.string(),
  })
  return base.superRefine((v, ctx) => {
    if (systemType === 'SNMP') {
      if (!isEditing && v.community.length === 0)
        ctx.addIssue({ code: 'custom', path: ['community'], message: 'Community is required' })
      return
    }
    if (!isEditing) {
      if (v.user.length === 0) ctx.addIssue({ code: 'custom', path: ['user'], message: 'User is required' })
      if (v.password.length === 0) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password is required' })
      return
    }
    if ((v.user.length > 0) !== (v.password.length > 0))
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'Enter both user and password to change credentials' })
  })
}
type Form = z.infer<ReturnType<typeof makeSchema>>

export function CredentialDrawer({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Credential | null
}) {
  const create = useCreateCredential()
  const update = useUpdateCredential()

  // `editing` can change across renders without remounting this drawer, so the
  // resolver reads the latest value via a ref rather than one captured at mount.
  const editingRef = useRef(editing)
  editingRef.current = editing

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<Form>({
      resolver: (values, context, options) =>
        zodResolver(makeSchema(!!editingRef.current, values.system_type as SystemType))(values, context, options),
      defaultValues: { system_type: 'LINUX' },
    })

  const systemType = watch('system_type')

  // Prefill name/type on edit; never prefill the password (write-only).
  useEffect(() => {
    reset({
      credential_name: editing?.credential_name ?? '',
      system_type: (editing?.system_type as SystemType) ?? 'LINUX',
      user: '',
      password: '',
      community: '',
    })
  }, [editing, open, reset])

  const onSubmit = (v: Form) => {
    const done = { onSuccess: () => { toast.success('Saved'); onOpenChange(false) }, onError: (e: unknown) => toast.error((e as Error).message) }
    // Password/community are write-only and never prefilled; leaving them
    // blank on edit means "keep the existing credential" — omit cred_data
    // entirely so the backend doesn't overwrite it with an empty value.
    const credData = v.system_type === 'SNMP'
      ? (v.community ? { community: v.community } : null)
      : (v.password ? { user: v.user, password: v.password } : null)
    if (editing) {
      const payload = credData
        ? { credential_name: v.credential_name, protocol: v.system_type, cred_data: credData }
        : { credential_name: v.credential_name, protocol: v.system_type }
      update.mutate({ id: editing.id, input: payload }, done)
    } else {
      // The schema guarantees credData is non-null on create.
      create.mutate({ credential_name: v.credential_name, protocol: v.system_type, cred_data: credData! }, done)
    }
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
          {systemType === 'SNMP' ? (
            <div><Label htmlFor="community">Community</Label><Input id="community" {...register('community')} />
              {errors.community && <p className="text-xs text-red-600">{errors.community.message}</p>}</div>
          ) : (
            <>
              <div><Label htmlFor="user">User</Label><Input id="user" {...register('user')} />
                {errors.user && <p className="text-xs text-red-600">{errors.user.message}</p>}</div>
              <div><Label htmlFor="password">Password</Label><Input id="password" type="password" {...register('password')} />
                {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}</div>
            </>
          )}
          <Button type="submit" className="w-full" disabled={create.isPending || update.isPending}>Save</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
