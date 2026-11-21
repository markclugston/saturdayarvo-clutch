import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogBackdrop, DialogDescription, DialogPopup,
  DialogPortal, DialogTitle,
} from '@/components/ui/dialog'
import { ErrorMessage } from '@/components/ui/error-message'

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
          <DialogTitle>Import Ended</DialogTitle>
          <DialogDescription>
            Your import was ended by {userName} in another session. Return to this account&apos;s transactions to continue.
          </DialogDescription>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <Button ref={acknowledge} type="button" disabled={busy} onClick={onAcknowledge}>
            {busy ? 'Returning to Transactions…' : 'Return to Transactions'}
          </Button>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
