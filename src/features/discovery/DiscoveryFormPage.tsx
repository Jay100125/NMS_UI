import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loading, ErrorState } from '@/components/states'
import { useCredentials } from '@/features/credentials/useCredentials'
import { useCreateDiscovery, useUpdateDiscovery } from './useDiscovery'
import { useDiscoveryDetail } from './useDiscoveryDetail'
import { TARGET_TYPES, type TargetType, targetError, inferTargetType, DEFAULT_PORTS } from './targetSchema'
import type { SystemType } from '@/lib/types'

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

export function DiscoveryFormPage() {
  const { id } = useParams<{ id: string }>()
  const editingId = id ? Number(id) : null
  const navigate = useNavigate()
  const detail = useDiscoveryDetail(editingId ?? -1, { enabled: editingId !== null })
  const { data: credentials } = useCredentials()
  const create = useCreateDiscovery()
  const update = useUpdateDiscovery()

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } =
    useForm<FormInput, unknown, FormOutput>({
      resolver: zodResolver(schema),
      defaultValues: { plugin_type: 'LINUX', target_type: 'IP', port: 22, credential_profile_ids: [] },
    })

  const pluginType = watch('plugin_type') as SystemType

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

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold">{editingId !== null ? 'Edit discovery' : 'New discovery'}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div><Label htmlFor="discovery_profile_name">Name</Label><Input id="discovery_profile_name" {...register('discovery_profile_name')} />
          {errors.discovery_profile_name && <p className="text-xs text-red-600">{errors.discovery_profile_name.message}</p>}</div>

        <div>
          <Label id="plugin-type-label">Device type</Label>
          <Controller control={control} name="plugin_type" render={({ field }) => (
            <Select value={field.value} onValueChange={(v) => onTypeChange(v as SystemType)}>
              <SelectTrigger aria-labelledby="plugin-type-label"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LINUX">LINUX</SelectItem>
                <SelectItem value="SNMP">SNMP</SelectItem>
                <SelectItem value="WINRM">WINRM</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label id="target-type-label">Target type</Label>
            <Controller control={control} name="target_type" render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => { if (v) field.onChange(v) }}>
                <SelectTrigger aria-labelledby="target-type-label"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IP">IP</SelectItem>
                  <SelectItem value="RANGE">IP Range</SelectItem>
                  <SelectItem value="CIDR">CIDR</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="ip">Target</Label>
            <Input id="ip" placeholder="192.168.1.1 / 192.168.1.10-192.168.1.120 / 192.168.1.0/24" {...register('ip')} />
            {errors.ip && <p className="text-xs text-red-600">{errors.ip.message}</p>}
          </div>
        </div>

        <div><Label htmlFor="port">Port</Label><Input id="port" type="number" {...register('port')} />
          {errors.port && <p className="text-xs text-red-600">{errors.port.message}</p>}</div>

        <div>
          <Label>Credentials ({pluginType})</Label>
          <Controller control={control} name="credential_profile_ids" render={({ field }) => (
            <div className="space-y-2">
              {matching.length === 0 && <p className="text-sm text-muted-foreground">No {pluginType} credentials — create one first.</p>}
              {matching.map((c) => {
                const checked = field.value.includes(c.id)
                const inputId = `credential-${c.id}`
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <Checkbox id={inputId} checked={checked}
                      onCheckedChange={(v) => field.onChange(v ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))} />
                    <Label htmlFor={inputId} className="font-normal">{c.credential_name}</Label>
                  </div>
                )
              })}
            </div>
          )} />
          {errors.credential_profile_ids && <p className="text-xs text-red-600">{errors.credential_profile_ids.message}</p>}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending || update.isPending}>Save</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/discovery')}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
