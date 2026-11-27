import { CircleAlert } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogBackdrop, DialogDescription, DialogPopup,
  DialogPortal, DialogTitle,
} from '@/components/ui/dialog'

type AssetEditEndedDialogProps = {
  userName: string
  onAcknowledge: () => void
}

/** Blocking: only its button leaves it, because nothing on the page can be saved any more. */
export function AssetEditEndedDialog({ userName, onAcknowledge }: AssetEditEndedDialogProps) {
  const acknowledge = useRef<HTMLButtonElement>(null)
  return (
    <Dialog open modal disablePointerDismissal onOpenChange={(_open, details) => details.cancel()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="space-y-4 p-6" initialFocus={acknowledge} role="alertdialog">
          <div className="flex items-center gap-2">
            <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-danger" />
            <DialogTitle>Edit Ended</DialogTitle>
          </div>
          <DialogDescription>
            Your edit of this asset was ended by {userName} in another session. Your changes were not saved.
          </DialogDescription>
          <Button onClick={onAcknowledge} ref={acknowledge} type="button">Return To Assets</Button>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
