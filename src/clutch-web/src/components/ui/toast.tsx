import { Toast } from '@base-ui/react/toast'
import type { ReactNode } from 'react'

/** Bottom-right on desktop, bottom-centre below 768 px. Auto-closes after 5 s; hover or focus pauses it. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider limit={3} timeout={5000}>
      {children}
      <ToastList />
    </Toast.Provider>
  )
}

function ToastList() {
  const { toasts } = Toast.useToastManager()

  return (
    <Toast.Viewport className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 md:left-auto md:right-4 md:translate-x-0">
      {toasts.map((toast) => (
        <Toast.Root
          className="pointer-events-auto flex items-center justify-between gap-3 rounded-card bg-raised px-4 py-3 text-sm text-fg shadow-float transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[starting-style]:translate-y-2 focus-visible:focus-ring"
          key={toast.id}
          aria-modal={undefined}
          role="status"
          toast={toast}
        >
          <Toast.Title className="font-medium" />
          <Toast.Close
            aria-hidden={false}
            className="cursor-pointer rounded-control px-2 py-1 text-sm font-medium text-primary hover:bg-hover focus-visible:focus-ring"
            type="button"
          >
            Dismiss
          </Toast.Close>
        </Toast.Root>
      ))}
    </Toast.Viewport>
  )
}

/** Shows a short confirmation toast. */
export function useToast(): { show: (message: string) => void } {
  const manager = Toast.useToastManager()
  return { show: (message) => { manager.add({ title: message }) } }
}
