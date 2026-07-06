import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useRegister } from './useAuth'

const schema = z.object({ username: z.string().min(1), password: z.string().min(8, 'Min 8 characters') })
type Form = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const { mutate, isPending } = useRegister()
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = (v: Form) =>
    mutate(v, {
      onSuccess: () => { toast.success('Account created — sign in'); navigate('/login') },
      onError: (e) => toast.error((e as Error).message),
    })

  return (
    <div className="grid h-screen place-items-center">
      <Card className="w-80 p-6">
        <h1 className="mb-4 text-lg font-semibold">Create account</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div><Label htmlFor="username">Username</Label><Input id="username" {...register('username')} />
            {errors.username && <p className="text-xs text-red-600">Required</p>}</div>
          <div><Label htmlFor="password">Password</Label><Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}</div>
          <Button type="submit" className="w-full" disabled={isPending}>Create account</Button>
        </form>
        <p className="mt-3 text-center text-sm">Have an account? <Link className="underline" to="/login">Sign in</Link></p>
      </Card>
    </div>
  )
}
