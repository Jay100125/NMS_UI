import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

export function Loading() {
  return <div className="space-y-2 p-4" data-testid="loading"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-4 text-sm text-red-600" role="alert">
      <p>{message}</p>
      {onRetry && <Button variant="outline" className="mt-2" onClick={onRetry}>Retry</Button>}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="p-8 text-center text-muted-foreground">{message}</div>
}
