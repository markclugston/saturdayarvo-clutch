import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PageHeading } from '@/components/ui/page-heading'
import { ApiError } from '@/lib/api/client'
import type { CategoryNode } from '@/lib/api/schemas'
import {
  categoryNodesQueryKey,
  createCategoryNode,
  getCategoryNodes,
  renameCategoryNode,
} from './api'
import { DeleteCategoryDialog } from './DeleteCategoryDialog'

const maxNameLength = 100

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const renameButtons = useRef(new Map<string, HTMLButtonElement>())
  const lastRenamedId = useRef<string | null>(null)

  // Return focus to the item's Rename button once the inline editor closes.
  useEffect(() => {
    if (renamingId === null && lastRenamedId.current !== null) {
      renameButtons.current.get(lastRenamedId.current)?.focus()
      lastRenamedId.current = null
    }
  }, [renamingId])
  const nodesQuery = useQuery({
    queryKey: categoryNodesQueryKey,
    queryFn: getCategoryNodes,
  })
  const createMutation = useMutation({
    mutationFn: () => createCategoryNode(name, parentId === '' ? null : parentId),
    onSuccess: async () => {
      setName('')
      await queryClient.invalidateQueries({ queryKey: categoryNodesQueryKey })
    },
  })
  const renameMutation = useMutation({
    mutationFn: ({ id, value }: { id: string, value: string }) => renameCategoryNode(id, value),
    onSuccess: async (_result, variables) => {
      lastRenamedId.current = variables.id
      setRenamingId(null)
      await queryClient.invalidateQueries({ queryKey: categoryNodesQueryKey })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMutation.mutate()
  }

  function submitRename(event: FormEvent<HTMLFormElement>, node: CategoryNode) {
    event.preventDefault()
    renameMutation.mutate({ id: node.id, value: renameValue })
  }

  if (nodesQuery.isPending) {
    return <p role="status">Loading categories…</p>
  }

  if (nodesQuery.isError) {
    return <p role="alert">{getErrorMessage(nodesQuery.error)}</p>
  }

  const nodes = nodesQuery.data
  // A parent that no longer exists (e.g. deleted) falls back to "None".
  const selectedParentId = nodes.some((node) => node.id === parentId) ? parentId : ''

  return (
    <section aria-labelledby="categories-heading" className="space-y-8">
      <div>
        <PageHeading id="categories-heading" className="text-2xl font-semibold">
          Categories and groups
        </PageHeading>
        <p className="mt-2 text-muted-foreground">
          Groups organise your categories. Categories can also sit inside other categories.
        </p>
      </div>

      {nodes.length === 0 ? (
        <p className="text-muted-foreground">
          You have no groups or categories yet. Create your first group below.
        </p>
      ) : (
        <ul aria-label="Groups and categories" className="space-y-1">
          {nodes.map((node) => {
            const isGroup = node.parentId === null
            return (
              <li
                key={node.id}
                className={isGroup ? 'mt-6 first:mt-0' : undefined}
                style={{ paddingLeft: `${node.depth * 1.5}rem` }}
              >
                {renamingId === node.id ? (
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(event) => submitRename(event, node)}
                  >
                    <label className="sr-only" htmlFor={`rename-${node.id}`}>
                      New name for {node.name}
                    </label>
                    <input
                      id={`rename-${node.id}`}
                      autoComplete="off"
                      autoFocus
                      className="rounded-md border border-input bg-background px-3 py-1"
                      maxLength={maxNameLength}
                      required
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.currentTarget.value)}
                    />
                    <button
                      className="cursor-pointer rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={renameMutation.isPending}
                      type="submit"
                    >
                      Save
                    </button>
                    <button
                      className="cursor-pointer rounded-md border border-border px-3 py-1 text-sm hover:bg-muted"
                      onClick={() => {
                        lastRenamedId.current = node.id
                        setRenamingId(null)
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                    {renameMutation.isError && (
                      <p role="alert">{getErrorMessage(renameMutation.error)}</p>
                    )}
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={isGroup ? 'text-xl font-semibold' : 'text-base'}>
                      {node.name}
                    </span>
                    <button
                      aria-label={`Rename ${node.name}`}
                      className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      onClick={() => {
                        renameMutation.reset()
                        setRenamingId(node.id)
                        setRenameValue(node.name)
                      }}
                      ref={(element) => {
                        if (element) {
                          renameButtons.current.set(node.id, element)
                        } else {
                          renameButtons.current.delete(node.id)
                        }
                      }}
                      type="button"
                    >
                      Rename
                    </button>
                    <button
                      aria-label={`Delete ${node.name}`}
                      className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      onClick={() => setDeletingId(node.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                )}
                {deletingId === node.id && (
                  <DeleteCategoryDialog node={node} onClose={() => setDeletingId(null)} />
                )}
              </li>
            )
          })}
        </ul>
      )}

      <form className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-5" onSubmit={submit}>
        <h2 className="text-lg font-semibold">Add a group or category</h2>
        <div className="space-y-2">
          <label htmlFor="category-name" className="block text-sm font-medium">Name</label>
          <input
            id="category-name"
            autoComplete="off"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            maxLength={maxNameLength}
            required
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="category-parent" className="block text-sm font-medium">Parent</label>
          <select
            id="category-parent"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            value={selectedParentId}
            onChange={(event) => setParentId(event.currentTarget.value)}
          >
            <option value="">None (create a group)</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {'\u00A0\u00A0'.repeat(node.depth)}{node.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="cursor-pointer rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={createMutation.isPending}
          type="submit"
        >
          {createMutation.isPending ? 'Saving…' : 'Add'}
        </button>
        {createMutation.isError && <p role="alert">{getErrorMessage(createMutation.error)}</p>}
      </form>
    </section>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
