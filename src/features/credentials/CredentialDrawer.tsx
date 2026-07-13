import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Terminal, Network, AppWindow, Eye, EyeOff, ShieldCheck, type LucideIcon } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateCredential, useUpdateCredential } from './useCredentials'
import type { Credential, SystemType } from '@/lib/types'

const TYPE_META: Record<SystemType, { proto: string; icon: LucideIcon }> = {
  LINUX: { proto: 'SSH', icon: Terminal },
  SNMP: { proto: 'SNMP v2c', icon: Network },
  WINRM: { proto: 'WinRM', icon: AppWindow },
}
const TYPES = Object.keys(TYPE_META) as SystemType[]

// On create, user/password (or, for SNMP, community) are required. On edit,
// they may be left blank to keep the existing cred_data (password is
// write-only and never prefilled). If exactly one of user/password is filled
// on edit, that's invalid — changing credentials is all-or-nothing so we
// never overwrite one half with ''.
// The "blank = keep existing" escape hatch only applies when the credential's
// type hasn't changed: the persisted cred_data is shaped for the OLD type, so
// switching type must force fresh fields for the new type (otherwise we'd
// overwrite system_type while keeping wrongly-shaped encrypted cred_data).
function makeSchema(isEditing: boolean, systemType: SystemType, typeChanged: boolean) {
  const base = z.object({
    credential_name: z.string().min(1, 'Name is required'),
    system_type: z.enum(['LINUX', 'SNMP', 'WINRM']),
    user: z.string(),
    password: z.string(),
    community: z.string(),
  })
  const fieldsRequired = !isEditing || typeChanged
  return base.superRefine((v, ctx) => {
    if (systemType === 'SNMP') {
      if (fieldsRequired && v.community.length === 0)
        ctx.addIssue({ code: 'custom', path: ['community'], message: 'Community is required' })
      return
    }
    if (fieldsRequired) {
      if (v.user.length === 0) ctx.addIssue({ code: 'custom', path: ['user'], message: 'User is required' })
      if (v.password.length === 0) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password is required' })
      return
    }
    if ((v.user.length > 0) !== (v.password.length > 0))
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'Enter both user and password to change credentials' })
  })
}
type Form = z.infer<ReturnType<typeof makeSchema>>

export function CredentialDrawer({ open, onOpenChange, editing, defaultSystemType, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Credential | null
  // When creating (editing === null), preselect this protocol instead of LINUX.
  defaultSystemType?: SystemType
  // Called with the new credential's id after a successful create.
  onCreated?: (id: number) => void
}) {
  const create = useCreateCredential()
  const update = useUpdateCredential()
  const [showPassword, setShowPassword] = useState(false)

  // `editing` can change across renders without remounting this drawer, so the
  // resolver reads the latest value via a ref rather than one captured at mount.
  const editingRef = useRef(editing)
  editingRef.current = editing

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<Form>({
      resolver: (values, context, options) => {
        const typeChanged = !!editingRef.current && values.system_type !== editingRef.current.system_type
        return zodResolver(makeSchema(!!editingRef.current, values.system_type as SystemType, typeChanged))(values, context, options)
      },
      defaultValues: { system_type: defaultSystemType ?? 'LINUX' },
    })

  const systemType = watch('system_type')

  // Prefill name/type on edit; never prefill the password (write-only).
  useEffect(() => {
    reset({
      credential_name: editing?.credential_name ?? '',
      system_type: (editing?.system_type as SystemType) ?? defaultSystemType ?? 'LINUX',
      user: '',
      password: '',
      community: '',
    })
    setShowPassword(false)
  }, [editing, open, defaultSystemType, reset])

  const onSubmit = (v: Form) => {
    const done = { onSuccess: () => { toast.success('Saved'); onOpenChange(false) }, onError: (e: unknown) => toast.error((e as Error).message) }
    // Password/community are write-only and never prefilled; leaving them
    // blank on edit means "keep the existing credential" — omit cred_data
    // entirely so the backend doesn't overwrite it with an empty value. This
    // only applies when the type is unchanged: the schema forces fresh fields
    // whenever type changes, so credData is guaranteed non-null in that case.
    const credData = v.system_type === 'SNMP'
      ? (v.community ? { community: v.community } : null)
      : (v.password ? { user: v.user, password: v.password } : null)
    if (editing) {
      const typeChanged = v.system_type !== editing.system_type
      const payload = (credData || typeChanged)
        ? { credential_name: v.credential_name, protocol: v.system_type, cred_data: credData! }
        : { credential_name: v.credential_name, protocol: v.system_type }
      update.mutate({ id: editing.id, input: payload }, done)
    } else {
      // The schema guarantees credData is non-null on create.
      create.mutate(
        { credential_name: v.credential_name, protocol: v.system_type, cred_data: credData! },
        {
          onSuccess: (data) => {
            toast.success('Saved')
            onOpenChange(false)
            const created = Array.isArray(data) ? (data[0] as { id?: number } | undefined) : undefined
            if (created?.id != null) onCreated?.(created.id)
          },
          onError: (e: unknown) => toast.error((e as Error).message),
        },
      )
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="space-y-1 border-b px-6 py-5">
          <SheetTitle className="text-xl">{editing ? 'Edit credential' : 'New credential'}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            A reusable identity Lite-NMS uses to reach your devices. Secrets are encrypted at rest.
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div className="space-y-1.5">
              <Label htmlFor="credential_name">Name</Label>
              <Input id="credential_name" placeholder="e.g. lab-linux-root" {...register('credential_name')} />
              {errors.credential_name && <p className="text-xs text-red-600">{errors.credential_name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Protocol</Label>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((t) => {
                  const { proto, icon: Icon } = TYPE_META[t]
                  const active = systemType === t
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setValue('system_type', t)}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors ${
                        active
                          ? 'border-primary bg-accent text-foreground shadow-sm'
                          : 'border-border text-muted-foreground hover:border-foreground/30 hover:bg-muted'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-medium text-foreground">{t}</span>
                      <span className="text-[11px] text-muted-foreground">{proto}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {systemType === 'SNMP' ? (
              <div className="space-y-1.5">
                <Label htmlFor="community">Community string</Label>
                <Input id="community" placeholder="e.g. public" {...register('community')} />
                {errors.community
                  ? <p className="text-xs text-red-600">{errors.community.message}</p>
                  : <p className="text-xs text-muted-foreground">Uses SNMP v2c. v3 (auth/priv, SHA/AES) isn&apos;t supported yet.</p>}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="user">User</Label>
                  <Input id="user" autoComplete="off" placeholder={systemType === 'WINRM' ? 'e.g. Administrator' : 'e.g. root'} {...register('user')} />
                  {errors.user && <p className="text-xs text-red-600">{errors.user.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="pr-10"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password
                    ? <p className="text-xs text-red-600">{errors.password.message}</p>
                    : editing && <p className="text-xs text-muted-foreground">Leave blank to keep the current password.</p>}
                </div>
              </>
            )}

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Stored encrypted; secrets are never shown again after saving.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Create credential'}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
