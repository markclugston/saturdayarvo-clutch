import { LoaderCircle } from 'lucide-react'

type StartupLoadingDialogProps = {
  open: boolean
}

export function StartupLoadingDialog({ open }: StartupLoadingDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 p-4 backdrop-blur-[2px]" data-slot="startup-backdrop">
      <div className="w-full max-w-md space-y-4 rounded-card bg-card p-6 text-fg shadow-float" role="status">
        <div className="flex items-center gap-3">
          <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin text-fg-secondary" />
          <p className="text-lg font-semibold leading-none tracking-tight">Checking Your Session</p>
        </div>
        <p className="text-sm text-fg-secondary">Please wait while we check your session.</p>
      </div>
    </div>
  )
}
