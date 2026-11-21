import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react'
import { DiscardChangesDialog } from './DiscardChangesDialog'

type UnsavedChanges = {
  /** True while a screen has edits that are not saved. */
  isDirty: boolean
  /** A screen reports whether it has unsaved edits. Nothing is stored. */
  setDirty: (dirty: boolean) => void
  /** Runs the action now when clean; otherwise asks the user to discard or stay first. */
  run: (action: () => void) => void
}

const UnsavedChangesContext = createContext<UnsavedChanges | null>(null)

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false)
  const dirtyRef = useRef(false)
  const [pending, setPending] = useState<(() => void) | null>(null)

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
    setIsDirty(dirty)
  }, [])

  const run = useCallback((action: () => void) => {
    if (!dirtyRef.current) {
      action()
      return
    }
    setPending(() => action)
  }, [])

  // The browser's own prompt for refresh and close, only while there are unsaved edits.
  useEffect(() => {
    if (!isDirty) {
      return
    }
    const listener = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', listener)
    return () => window.removeEventListener('beforeunload', listener)
  }, [isDirty])

  const value = useMemo(() => ({ isDirty, setDirty, run }), [isDirty, setDirty, run])

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      {pending && (
        <DiscardChangesDialog
          onDiscard={() => {
            const action = pending
            setPending(null)
            setDirty(false)
            action()
          }}
          onStay={() => setPending(null)}
        />
      )}
    </UnsavedChangesContext.Provider>
  )
}

export function useUnsavedChanges(): UnsavedChanges {
  const context = useContext(UnsavedChangesContext)
  if (!context) {
    throw new Error('useUnsavedChanges must be used inside UnsavedChangesProvider')
  }
  return context
}
