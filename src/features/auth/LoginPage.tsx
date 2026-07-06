import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthCard } from './AuthCard'
import { useLogin } from './useAuth'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})
type Form = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const { mutate, isPending } = useLogin()
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = (v: Form) =>
    mutate(v, { onSuccess: () => navigate('/'), onError: (e) => toast.error((e as Error).message) })

  return (
    <AuthCard
      title="Sign in"
      footer={<>No account? <Link className="underline" to="/register">Register</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div><Label htmlFor="username">Username</Label><Input id="username" {...register('username')} />
          {errors.username && <p className="text-xs text-red-600">{errors.username.message}</p>}</div>
        <div><Label htmlFor="password">Password</Label><Input id="password" type="password" {...register('password')} />
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}</div>
        <Button type="submit" className="w-full" disabled={isPending}>Sign in</Button>
      </form>
    </AuthCard>
  )
}
