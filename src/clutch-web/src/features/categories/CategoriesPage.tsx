import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
import { FloatingField } from '@/components/ui/floating-field'
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
    return <p className="text-fg-secondary" role="status">Loading categories…</p>
  }

  if (nodesQuery.isError) {
    return <ErrorMessage>{getErrorMessage(nodesQuery.error)}</ErrorMessage>
  }

  const nodes = nodesQuery.data
  // A parent that no longer exists (e.g. deleted) falls back to "None".
  const selectedParentId = nodes.some((node) => node.id === parentId) ? parentId : ''

  return (
    <section aria-labelledby="categories-heading" className="space-y-4">
      <div>
        <PageHeading id="categories-heading">
          Categories and groups
        </PageHeading>
        <p className="mt-2 text-fg-secondary">
          Groups organise your categories. Categories can also sit inside other categories.
        </p>
      </div>

      {nodes.length === 0 ? (
        <Card>
          <p className="text-fg-secondary">
            You have no groups or categories yet. Create your first group below.
          </p>
        </Card>
      ) : (
        <Card>
        <ul
          aria-label="Groups and categories"
          className="space-y-1 overflow-x-auto focus-visible:focus-ring"
          tabIndex={0}
        >
          {nodes.map((node) => {
            const isGroup = node.parentId === null
            // Reserve room for actions while preserving indentation in the scrollable list.
            return (
              <li
                key={node.id}
                className={isGroup ? 'mt-6 first:mt-0' : undefined}
                style={{
                  paddingLeft: `${node.depth * 1.5}rem`,
                  minWidth: `calc(${node.depth * 1.5}rem + 8rem)`,
                }}
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
                      className="max-w-full min-w-0 rounded-control bg-raised px-3 py-1 text-fg focus-visible:focus-ring"
                      maxLength={maxNameLength}
                      required
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.currentTarget.value)}
                    />
                    <Button
                      disabled={renameMutation.isPending}
                      size="sm"
                      type="submit"
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        lastRenamedId.current = node.id
                        setRenamingId(null)
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                    {renameMutation.isError && (
                      <ErrorMessage>{getErrorMessage(renameMutation.error)}</ErrorMessage>
                    )}
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={isGroup ? 'min-w-0 break-words text-xl font-semibold' : 'min-w-0 break-words text-base'}>
                      {node.name}
                    </span>
                    <Button
                      aria-label={`Rename ${node.name}`}
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
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Rename
                    </Button>
                    <Button
                      aria-label={`Delete ${node.name}`}
                      onClick={() => setDeletingId(node.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Delete
                    </Button>
                  </div>
                )}
                {deletingId === node.id && (
                  <DeleteCategoryDialog node={node} onClose={() => setDeletingId(null)} />
                )}
              </li>
            )
          })}
        </ul>
        </Card>
      )}

      <Card as="form" className="max-w-xl space-y-4" onSubmit={submit}>
        <CardTitle as="h2">Add a group or category</CardTitle>
        <FloatingField
          autoComplete="off"
          id="category-name"
          label="Name"
          maxLength={maxNameLength}
          onChange={(event) => setName(event.currentTarget.value)}
          required
          value={name}
        />
        <FloatingField
          as="select"
          id="category-parent"
          label="Parent"
          onChange={(event) => setParentId(event.currentTarget.value)}
          value={selectedParentId}
        >
          <option value="">None (create a group)</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {'\u00A0\u00A0'.repeat(node.depth)}{node.name}
            </option>
          ))}
        </FloatingField>
        <Button disabled={createMutation.isPending} type="submit">
          {createMutation.isPending ? 'Saving…' : 'Add'}
        </Button>
        {createMutation.isError && <ErrorMessage>{getErrorMessage(createMutation.error)}</ErrorMessage>}
      </Card>
    </section>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
