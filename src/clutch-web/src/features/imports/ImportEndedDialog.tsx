import { useRef } from 'react'
import {
  Dialog, DialogBackdrop, DialogDescription, DialogPopup,
  DialogPortal, DialogTitle,
} from '@/components/ui/dialog'

type ImportEndedDialogProps = {
  userName: string
  busy?: boolean
  error?: string
  onAcknowledge: () => void
}

export function ImportEndedDialog({ userName, busy = false, error, onAcknowledge }: ImportEndedDialogProps) {
  const acknowledge = useRef<HTMLButtonElement>(null)
  return (
    <Dialog open modal disablePointerDismissal onOpenChange={(_open, details) => details.cancel()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="space-y-4 p-6" initialFocus={acknowledge}>
          <DialogTitle>Import ended</DialogTitle>
          <DialogDescription>
            Your import was ended by {userName} in another session. Return to this account&apos;s transactions to continue.
          </DialogDescription>
          {error && <p role="alert">{error}</p>}
          <button ref={acknowledge} type="button" disabled={busy} onClick={onAcknowledge}
            className="cursor-pointer rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
            {busy ? 'Returning to transactions…' : 'Return to transactions'}
          </button>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
