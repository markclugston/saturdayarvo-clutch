import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogBackdrop, DialogDescription, DialogPopup,
  DialogPortal, DialogTitle,
} from '@/components/ui/dialog'

type DiscardChangesDialogProps = {
  onDiscard: () => void
  onStay: () => void
}

export function DiscardChangesDialog({ onDiscard, onStay }: DiscardChangesDialogProps) {
  const stay = useRef<HTMLButtonElement>(null)
  return (
    <Dialog open modal onOpenChange={(_open, details) => { details.cancel(); onStay() }}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="space-y-4 p-6" initialFocus={stay}>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogDescription>
            You have changes that have not been saved. If you continue they will be lost.
          </DialogDescription>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onDiscard} type="button" variant="danger">Discard changes</Button>
            <Button onClick={onStay} ref={stay} type="button" variant="secondary">Stay on this page</Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
