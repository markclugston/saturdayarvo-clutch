import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogBackdrop, DialogDescription, DialogPopup,
  DialogPortal, DialogTitle,
} from '@/components/ui/dialog'

type SessionExpiredDialogProps = {
  onStay: () => void
  onSignInAgain: () => void
}

export function SessionExpiredDialog({ onStay, onSignInAgain }: SessionExpiredDialogProps) {
  const stay = useRef<HTMLButtonElement>(null)
  return (
    <Dialog open modal onOpenChange={(_open, details) => { details.cancel(); onStay() }}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="space-y-4 p-6" initialFocus={stay}>
          <DialogTitle>Your Sign-In Has Expired</DialogTitle>
          <DialogDescription>
            Signing in again will lose your unsaved changes. Stay on this page to copy them first.
          </DialogDescription>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onStay} ref={stay} type="button" variant="secondary">Stay on This Page</Button>
            <Button onClick={onSignInAgain} type="button">Sign In Again</Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
