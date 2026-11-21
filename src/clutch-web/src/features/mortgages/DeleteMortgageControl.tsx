import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useUnsavedChanges } from '@/components/unsaved-changes/UnsavedChangesProvider'
import type { Mortgage } from '@/lib/api/schemas'
import {
  MortgageChangedError,
  MortgageGoneError,
  MortgageUnauthorizedError,
  deleteMortgage,
} from './api'
import { DeleteMortgageDialog } from './DeleteMortgageDialog'

type DeleteMortgageControlProps = {
  mortgage: Mortgage
  /** A delete succeeded. */
  onDeleted: (id: string) => void
  /** A delete found the mortgage already gone (404). */
  onGone: (id: string) => void
  onUnauthorized: () => void
  /** Fetches the latest mortgages after a delete clash. Rejects when they cannot be loaded. */
  onReload: () => Promise<void>
}

/** The red trash button for the shown mortgage, and the confirmation dialog it opens. */
export function DeleteMortgageControl({
  mortgage,
  onDeleted,
  onGone,
  onUnauthorized,
  onReload,
}: DeleteMortgageControlProps) {
  const { isDirty, run } = useUnsavedChanges()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const [reloadFailed, setReloadFailed] = useState(false)

  function closeDialog() {
    setOpen(false)
    setDeleting(false)
    setConflict(false)
    setReloading(false)
    setDeleteFailed(false)
    setReloadFailed(false)
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteFailed(false)
    try {
      await deleteMortgage(mortgage.id, mortgage.version)
      closeDialog()
      onDeleted(mortgage.id)
    } catch (error) {
      setDeleting(false)
      if (error instanceof MortgageGoneError) {
        closeDialog()
        onGone(mortgage.id)
      } else if (error instanceof MortgageChangedError) {
        setConflict(true)
      } else if (error instanceof MortgageUnauthorizedError) {
        closeDialog()
        onUnauthorized()
      } else {
        setDeleteFailed(true)
      }
    }
  }

  async function reload() {
    setReloading(true)
    setReloadFailed(false)
    try {
      await onReload()
      closeDialog()
    } catch (error) {
      setReloading(false)
      if (error instanceof MortgageUnauthorizedError) {
        closeDialog()
        onUnauthorized()
      } else {
        setReloadFailed(true)
      }
    }
  }

  return (
    <>
      <Button
        aria-label={`Delete ${mortgage.name}`}
        onClick={() => {
          closeDialog()
          setOpen(true)
        }}
        size="icon"
        type="button"
        variant="icon"
      >
        <Trash2 aria-hidden="true" className="size-4 text-danger" />
      </Button>
      {open && (
        <DeleteMortgageDialog
          conflict={conflict}
          deleteFailed={deleteFailed}
          deleting={deleting}
          name={mortgage.name}
          onCancel={closeDialog}
          onDelete={() => void confirmDelete()}
          onReload={() => {
            if (isDirty) {
              // Stay closes the dialog with the values unchanged; Discard reloads.
              setOpen(false)
              run(() => void reload())
            } else {
              void reload()
            }
          }}
          reloadFailed={reloadFailed}
          reloading={reloading}
        />
      )}
    </>
  )
}
