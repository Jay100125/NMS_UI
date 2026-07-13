import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Terminal, Network, AppWindow, KeyRound, Check, ChevronsUpDown, Plus, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loading, ErrorState } from '@/components/states'
import { CredentialDrawer } from '@/features/credentials/CredentialDrawer'
import { useCredentials } from '@/features/credentials/useCredentials'
import { useCreateDiscovery, useUpdateDiscovery } from './useDiscovery'
import { useDiscoveryDetail } from './useDiscoveryDetail'
import { TARGET_TYPES, type TargetType, targetError, inferTargetType, DEFAULT_PORTS } from './targetSchema'
import type { Credential, SystemType } from '@/lib/types'

const schema = z.object({
  discovery_profile_name: z.string().min(1, 'Required'),
  plugin_type: z.enum(['LINUX', 'SNMP', 'WINRM']),
  target_type: z.enum(TARGET_TYPES),
  ip: z.string().min(1, 'Required'),
  port: z.coerce.number().int().min(1).max(65535),
  credential_profile_ids: z.array(z.number()).min(1, 'Select at least one credential'),
}).superRefine((v, ctx) => {
  const err = targetError(v.target_type as TargetType, v.ip)
  if (err) ctx.addIssue({ code: 'custom', path: ['ip'], message: err })
})
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

const TYPE_META: Record<SystemType, { proto: string; icon: LucideIcon }> = {
  LINUX: { proto: 'SSH', icon: Terminal },
  SNMP: { proto: 'SNMP v2c', icon: Network },
  WINRM: { proto: 'WinRM', icon: AppWindow },
}
const DEVICE_TYPES = Object.keys(TYPE_META) as SystemType[]

const TARGET_META: Record<TargetType, { label: string; placeholder: string }> = {
  IP: { label: 'Single IP', placeholder: '192.168.1.10' },
  RANGE: { label: 'IP Range', placeholder: '192.168.1.10-192.168.1.120' },
  CIDR: { label: 'CIDR', placeholder: '192.168.1.0/24' },
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-8 gap-y-4 border-t py-6 first:border-t-0 first:pt-0 md:grid-cols-[200px_1fr]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

// Dependency-free multi-select (no Popover package installed): a trigger that
// opens a checkbox panel, closing on outside-click or Escape. Scales to many
// credentials via a scrollable, filterable panel.
function CredentialMultiSelect({ options, value, onChange }: {
  options: Credential[]; value: number[]; onChange: (v: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const count = value.length
  const label = count === 0 ? 'Select credentials' : `${count} selected`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={count === 0 ? 'text-muted-foreground' : ''}>{label}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {options.map((c) => {
            const checked = value.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange(checked ? value.filter((x) => x !== c.id) : [...value, c.id])}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                }`}>
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{c.credential_name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function DiscoveryFormPage() {
  const { id } = useParams<{ id: string }>()
  const editingId = id ? Number(id) : null
  const navigate = useNavigate()
  const detail = useDiscoveryDetail(editingId ?? -1, { enabled: editingId !== null })
  const { data: credentials } = useCredentials()
  const create = useCreateDiscovery()
  const update = useUpdateDiscovery()

  const [credDrawerOpen, setCredDrawerOpen] = useState(false)

  const { register, handleSubmit, reset, control, watch, setValue, getValues, formState: { errors } } =
    useForm<FormInput, unknown, FormOutput>({
      resolver: zodResolver(schema),
      defaultValues: { plugin_type: 'LINUX', target_type: 'IP', port: 22, credential_profile_ids: [] },
    })

  const pluginType = watch('plugin_type') as SystemType
  const targetType = watch('target_type') as TargetType

  // Prefill on edit once the profile loads.
  useEffect(() => {
    if (editingId !== null && detail.data) {
      reset({
        discovery_profile_name: detail.data.discovery_profile_name,
        plugin_type: detail.data.plugin_type,
        target_type: inferTargetType(detail.data.ip),
        ip: detail.data.ip,
        port: detail.data.port,
        credential_profile_ids: detail.data.credential_profile_ids ?? [],
      })
    }
  }, [editingId, detail.data, reset])

  // Device type drives the default port and clears cross-type credential picks.
  const onTypeChange = (t: SystemType) => {
    if (!t) return
    setValue('plugin_type', t)
    setValue('port', DEFAULT_PORTS[t])
    setValue('credential_profile_ids', [])
  }

  const matching = useMemo(() => (credentials ?? []).filter((c) => c.system_type === pluginType), [credentials, pluginType])

  const onSubmit = (v: FormOutput) => {
    const payload = {
      discovery_profile_name: v.discovery_profile_name,
      ip: v.ip.trim(),
      port: v.port,
      credential_profile_ids: v.credential_profile_ids,
      plugin_type: v.plugin_type as SystemType,
    }
    const done = {
      onSuccess: () => { toast.success('Saved'); navigate('/discovery') },
      onError: (e: unknown) => toast.error((e as Error).message),
    }
    if (editingId !== null) update.mutate({ id: editingId, input: payload }, done)
    else create.mutate(payload, done)
  }

  if (editingId !== null && detail.isLoading) return <Loading />
  if (editingId !== null && detail.isError) return <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />

  const pending = create.isPending || update.isPending

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <button
        type="button"
        onClick={() => navigate('/discovery')}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Discovery
      </button>
      <h1 className="text-2xl font-semibold tracking-tight">{editingId !== null ? 'Edit discovery' : 'New discovery'}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tell Lite-NMS what to scan and how to authenticate.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 rounded-xl border bg-card p-6 md:p-8">
        <Section title="Profile" description="A name you'll recognize in the list.">
          <div className="space-y-1.5">
            <Label htmlFor="discovery_profile_name">Name</Label>
            <Input id="discovery_profile_name" placeholder="e.g. datacenter-linux" {...register('discovery_profile_name')} />
            {errors.discovery_profile_name && <p className="text-xs text-red-600">{errors.discovery_profile_name.message}</p>}
          </div>
        </Section>

        <Section title="Device type" description="Sets the protocol and default port.">
          <div className="grid grid-cols-3 gap-2">
            {DEVICE_TYPES.map((t) => {
              const { proto, icon: Icon } = TYPE_META[t]
              const active = pluginType === t
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onTypeChange(t)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors ${
                    active
                      ? 'border-primary bg-accent text-foreground shadow-sm'
                      : 'border-border text-muted-foreground hover:border-foreground/30 hover:bg-muted'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium text-foreground">{t}</span>
                  <span className="text-[11px] text-muted-foreground">{proto} · :{DEFAULT_PORTS[t]}</span>
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="Target" description="One host, a range, or a CIDR block.">
          <Controller control={control} name="target_type" render={({ field }) => (
            <div className="inline-flex rounded-lg border p-1">
              {TARGET_TYPES.map((t) => {
                const active = field.value === t
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => field.onChange(t)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {TARGET_META[t].label}
                  </button>
                )
              })}
            </div>
          )} />
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label htmlFor="ip">Address</Label>
              <Input id="ip" className="font-mono" placeholder={TARGET_META[targetType]?.placeholder} {...register('ip')} />
              {errors.ip && <p className="text-xs text-red-600">{errors.ip.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">Port</Label>
              <Input id="port" type="number" className="font-mono" {...register('port')} />
              {errors.port && <p className="text-xs text-red-600">{errors.port.message}</p>}
            </div>
          </div>
        </Section>

        <Section title="Credentials" description={`Which ${pluginType} identities to try.`}>
          <Controller control={control} name="credential_profile_ids" render={({ field }) => {
            const selected = matching.filter((c) => field.value.includes(c.id))
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <CredentialMultiSelect options={matching} value={field.value} onChange={field.onChange} />
                  </div>
                  <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={() => setCredDrawerOpen(true)}>
                    <Plus className="h-4 w-4" /> New credential
                  </Button>
                </div>

                {matching.length === 0 && (
                  <p className="text-xs text-muted-foreground">No {pluginType} credentials yet — create one to select it here.</p>
                )}

                {selected.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1 text-xs">
                        <KeyRound className="h-3 w-3 text-muted-foreground" />
                        {c.credential_name}
                        <button
                          type="button"
                          aria-label={`Remove ${c.credential_name}`}
                          onClick={() => field.onChange(field.value.filter((x) => x !== c.id))}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          }} />
          {errors.credential_profile_ids && <p className="text-xs text-red-600">{errors.credential_profile_ids.message}</p>}
        </Section>

        <div className="flex items-center justify-end gap-2 border-t pt-6">
          <Button type="button" variant="outline" onClick={() => navigate('/discovery')}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? 'Saving…' : editingId !== null ? 'Save changes' : 'Create discovery'}</Button>
        </div>
      </form>

      {/* Create a credential without leaving the form — protocol is preset to the
          selected device type, and the new credential is auto-selected. */}
      <CredentialDrawer
        open={credDrawerOpen}
        onOpenChange={setCredDrawerOpen}
        editing={null}
        defaultSystemType={pluginType}
        onCreated={(newId) => setValue('credential_profile_ids', [...getValues('credential_profile_ids'), newId], { shouldValidate: true })}
      />
    </div>
  )
}
