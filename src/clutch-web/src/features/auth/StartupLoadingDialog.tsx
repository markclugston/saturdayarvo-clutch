import { LoaderCircle } from 'lucide-react'

type StartupLoadingDialogProps = {
  open: boolean
}

export function StartupLoadingDialog({ open }: StartupLoadingDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[2px]" data-slot="startup-backdrop">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl" role="status">
        <div className="flex items-center gap-3">
          <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin text-muted-foreground" />
          <p className="text-lg font-semibold leading-none tracking-tight">Checking your session</p>
        </div>
        <p className="text-sm text-muted-foreground">Please wait while we check your session.</p>
      </div>
    </div>
  )
}
