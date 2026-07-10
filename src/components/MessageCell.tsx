import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

const MAX = 70

// A table cell for status/error messages. Short messages render inline; long ones
// (e.g. plugin stack traces) are truncated and open the full text in a dialog on click,
// so the column never blows up.
export function MessageCell({ message, ok }: { message?: string | null; ok?: boolean }) {
  const text = (message ?? '').trim()
  if (!text) return <span className="text-muted-foreground">—</span>

  const tone = ok ? 'text-emerald-600' : ''

  if (text.length <= MAX) {
    return <span className={`text-sm ${tone}`}>{text}</span>
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="max-w-[360px] truncate text-left text-sm text-red-600 underline decoration-dotted underline-offset-2 hover:text-foreground"
          title="Click to view the full message"
        >
          {text.slice(0, MAX)}…
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Message</DialogTitle></DialogHeader>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">{text}</pre>
      </DialogContent>
    </Dialog>
  )
}
