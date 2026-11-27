import { Toast } from '@base-ui/react/toast'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type PersistentManager = ReturnType<typeof Toast.createToastManager>

type PersistentToasts = {
  manager: PersistentManager
  /** Ids of the persistent toasts added, so they can all be cleared together. */
  ids: Set<string>
}

const PersistentToastContext = createContext<PersistentToasts | null>(null)

/**
 * Bottom-right on desktop, bottom-centre below 768 px. Regular toasts auto-close after 5 s; hover or
 * focus pauses them. Persistent toasts have their own stack at the bottom edge and stay until
 * dismissed; regular toasts show directly above them and never replace or push them out.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [persistent] = useState<PersistentToasts>(() => ({
    manager: Toast.createToastManager(),
    ids: new Set(),
  }))

  return (
    <PersistentToastContext.Provider value={persistent}>
      <Toast.Provider limit={3} timeout={5000}>
        {children}
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 md:left-auto md:right-4 md:translate-x-0">
          <ToastList label="Notifications" />
          <Toast.Provider limit={Number.MAX_SAFE_INTEGER} timeout={0} toastManager={persistent.manager}>
            <ToastList label="Persistent notifications" persistent />
          </Toast.Provider>
        </div>
      </Toast.Provider>
    </PersistentToastContext.Provider>
  )
}

function ToastList({ label, persistent = false }: { label: string; persistent?: boolean }) {
  const { toasts } = Toast.useToastManager()

  return (
    <Toast.Viewport aria-label={label} className="flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast.Root
          className="pointer-events-auto flex items-center justify-between gap-3 rounded-card bg-raised px-4 py-3 text-sm text-fg shadow-float transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[starting-style]:translate-y-2 focus-visible:focus-ring"
          key={toast.id}
          aria-modal={undefined}
          // A persistent toast is removed only by its Dismiss button: no Escape and no swipe.
          onKeyDown={persistent
            ? (event) => { if (event.key === 'Escape') event.preventBaseUIHandler() }
            : undefined}
          role="status"
          swipeDirection={persistent ? [] : undefined}
          toast={toast}
        >
          <Toast.Title className="min-w-0 break-words font-medium" />
          <Toast.Close
            aria-hidden={false}
            className="shrink-0 cursor-pointer rounded-control px-2 py-1 text-sm font-medium text-primary hover:bg-hover focus-visible:focus-ring"
            type="button"
          >
            Dismiss
          </Toast.Close>
        </Toast.Root>
      ))}
    </Toast.Viewport>
  )
}

/**
 * `show` is a short confirmation; `showPersistent` stays until the user dismisses it.
 * `clearPersistent` is for the end of a sign-in, so one user's notice is never shown to the next.
 */
export function useToast(): {
  show: (message: string) => void
  showPersistent: (message: string) => void
  clearPersistent: () => void
} {
  const manager = Toast.useToastManager()
  const persistent = useContext(PersistentToastContext)
  if (!persistent) {
    throw new Error('useToast must be used inside ToastProvider')
  }

  const clearPersistent = useCallback(() => {
    for (const id of persistent.ids) {
      persistent.manager.close(id)
    }
    persistent.ids.clear()
  }, [persistent])

  return {
    show: (message) => { manager.add({ title: message }) },
    showPersistent: (message) => {
      persistent.ids.add(persistent.manager.add({ title: message }))
    },
    clearPersistent,
  }
}
