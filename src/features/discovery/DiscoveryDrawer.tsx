import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useCredentials } from '@/features/credentials/useCredentials'
import { useCreateDiscovery, useUpdateDiscovery } from './useDiscovery'
import type { Discovery } from '@/lib/types'

const schema = z.object({
  discovery_profile_name: z.string().min(1, 'Required'),
  ip: z.string().min(1, 'Required'),
  port: z.coerce.number().int().min(1).max(65535),
  credential_profile_ids: z.array(z.number()).min(1, 'Select at least one credential'),
})
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export function DiscoveryDrawer({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Discovery | null
}) {
  const { data: credentials } = useCredentials()
  const create = useCreateDiscovery()
  const update = useUpdateDiscovery()
  const { register, handleSubmit, reset, control, formState: { errors } } =
    useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: { port: 22, credential_profile_ids: [] } })

  useEffect(() => {
    reset({
      discovery_profile_name: editing?.discovery_profile_name ?? '',
      ip: editing?.ip ?? '',
      port: editing?.port ?? 22,
      credential_profile_ids: editing?.credential_profile_ids ?? [],
    })
  }, [editing, open, reset])

  const onSubmit = (v: FormOutput) => {
    const payload = {
      discovery_profile_name: v.discovery_profile_name,
      ip: v.ip,
      port: v.port,
      credential_profile_ids: v.credential_profile_ids,
      plugin_type: 'LINUX' as const,
    }
    const done = { onSuccess: () => { toast.success('Saved'); onOpenChange(false) }, onError: (e: unknown) => toast.error((e as Error).message) }
    if (editing) update.mutate({ id: editing.id, input: payload }, done)
    else create.mutate(payload, done)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader><SheetTitle>{editing ? 'Edit discovery' : 'New discovery'}</SheetTitle></SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
          <div><Label htmlFor="discovery_profile_name">Name</Label><Input id="discovery_profile_name" {...register('discovery_profile_name')} />
            {errors.discovery_profile_name && <p className="text-xs text-red-600">{errors.discovery_profile_name.message}</p>}</div>
          <div><Label htmlFor="ip">IP</Label><Input id="ip" {...register('ip')} />
            {errors.ip && <p className="text-xs text-red-600">{errors.ip.message}</p>}</div>
          <div><Label htmlFor="port">Port</Label><Input id="port" type="number" {...register('port')} />
            {errors.port && <p className="text-xs text-red-600">{errors.port.message}</p>}</div>
          <div>
            <Label>Credentials</Label>
            <Controller
              control={control}
              name="credential_profile_ids"
              render={({ field }) => (
                <div className="space-y-2">
                  {(credentials ?? []).map((c) => {
                    const checked = field.value.includes(c.id)
                    const inputId = `credential-${c.id}`
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <Checkbox
                          id={inputId}
                          checked={checked}
                          onCheckedChange={(v) => {
                            field.onChange(v ? [...field.value, c.id] : field.value.filter((id) => id !== c.id))
                          }}
                        />
                        <Label htmlFor={inputId} className="font-normal">{c.credential_name}</Label>
                      </div>
                    )
                  })}
                </div>
              )}
            />
            {errors.credential_profile_ids && <p className="text-xs text-red-600">{errors.credential_profile_ids.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending || update.isPending}>Save</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
