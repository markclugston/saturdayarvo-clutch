import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import { FloatingField } from '@/components/ui/floating-field'
import { categoryNodesQueryKey, createCategoryNode, getCategoryNodes } from './api'
import { getErrorMessage } from './getErrorMessage'

const maxNameLength = 100

/** Pinned below the scrolling category list so it stays on screen however long the list grows. */
export function AddCategoryForm() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMutation.mutate()
  }

  const nodes = nodesQuery.data ?? []
  // A parent that no longer exists (e.g. deleted) falls back to "None".
  const selectedParentId = nodes.some((node) => node.id === parentId) ? parentId : ''

  return (
    // Styled like the content panel above; the canvas gap between them (the panel's bottom margin) separates the two.
    <form
      aria-labelledby="add-category-heading"
      className="m-2 mt-0 ml-0 shrink-0 space-y-3 rounded-panel bg-content p-4 lg:m-3 lg:mt-0 lg:ml-0 xl:p-6"
      onSubmit={submit}
    >
      <h2 className="text-base font-semibold" id="add-category-heading">Add a group or category</h2>
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-full sm:w-72">
          <FloatingField
            autoComplete="off"
            id="category-name"
            label="Name"
            maxLength={maxNameLength}
            onPanel
            onChange={(event) => setName(event.currentTarget.value)}
            required
            value={name}
          />
        </div>
        <div className="w-full sm:w-72">
          <FloatingField
            as="select"
            id="category-parent"
            label="Parent"
            onPanel
            onChange={(event) => setParentId(event.currentTarget.value)}
            value={selectedParentId}
          >
            <option value="">None (create a group)</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {'  '.repeat(node.depth)}{node.name}
              </option>
            ))}
          </FloatingField>
        </div>
        <Button disabled={createMutation.isPending} type="submit">
          {createMutation.isPending ? 'Saving…' : 'Add'}
        </Button>
      </div>
      {createMutation.isError && <ErrorMessage>{getErrorMessage(createMutation.error)}</ErrorMessage>}
    </form>
  )
}
