import { LoaderCircle } from 'lucide-react'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'

type StartupLoadingDialogProps = {
  open: boolean
}

export function StartupLoadingDialog({ open }: StartupLoadingDialogProps) {
  return (
    <Dialog open={open} modal disablePointerDismissal>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup aria-modal="true" className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin text-muted-foreground" />
            <DialogTitle>Checking your session</DialogTitle>
          </div>
          <DialogDescription>
            Please wait while we check your session.
          </DialogDescription>
          <p className="sr-only" role="status">
            Please wait while we check your session.
          </p>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
