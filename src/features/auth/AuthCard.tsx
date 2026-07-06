import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

export function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid h-screen place-items-center">
      <Card className="w-80 p-6">
        <h1 className="mb-4 text-lg font-semibold">{title}</h1>
        {children}
        <p className="mt-3 text-center text-sm">{footer}</p>
      </Card>
    </div>
  )
}
