import { Feather, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
import { PageHeading } from '@/components/ui/page-heading'
import type { CategoryNode } from '@/lib/api/schemas'
import {
  categoryNodesQueryKey,
  getCategoryNodes,
  renameCategoryNode,
} from './api'
import { DeleteCategoryDialog } from './DeleteCategoryDialog'
import { getErrorMessage } from './getErrorMessage'

const maxNameLength = 100

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const renameButtons = useRef(new Map<string, HTMLButtonElement>())
  const lastRenamedId = useRef<string | null>(null)
  const [containerRef, containerWidth] = useElementWidth()
  const scrollAreas = useRef(new Map<string, HTMLDivElement>())
  const [cardWidths, setCardWidths] = useState<Record<string, number>>({})

  // Measure each card's natural (unwrapped) width so columns are packed from real sizes.
  useLayoutEffect(() => {
    const next: Record<string, number> = {}
    for (const [id, area] of scrollAreas.current) {
      const card = area.parentElement
      if (card) {
        next[id] = area.scrollWidth + (card.offsetWidth - area.clientWidth)
      }
    }
    const keys = Object.keys(next)
    const changed = keys.length !== Object.keys(cardWidths).length
      || keys.some((key) => next[key] !== cardWidths[key])
    if (changed) {
      setCardWidths(next)
    }
  })

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
  const renameMutation = useMutation({
    mutationFn: ({ id, value }: { id: string, value: string }) => renameCategoryNode(id, value),
    onSuccess: async (_result, variables) => {
      lastRenamedId.current = variables.id
      setRenamingId(null)
      await queryClient.invalidateQueries({ queryKey: categoryNodesQueryKey })
    },
  })

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
        <div
          aria-label="Groups and categories"
          className="flex items-start gap-4"
          ref={containerRef}
          role="group"
        >
        {layoutColumns(groupNodes(nodes), containerWidth / 16, cardWidths).map((column) => (
        <div className="flex min-w-0 flex-col items-start gap-4" key={column[0]?.head.id}>
        {column.map((group) => (
        <Card className="max-w-full" key={group.head.id}>
        <div
          className="overflow-x-auto rounded-control focus-visible:focus-ring"
          ref={(element) => {
            if (element) {
              scrollAreas.current.set(group.head.id, element)
            } else {
              scrollAreas.current.delete(group.head.id)
            }
          }}
          tabIndex={0}
        >
        <table aria-label={`${group.head.name} and its categories`} className="w-full text-left">
          <tbody>
          {group.nodes.map((node) => {
            const isGroup = node.parentId === null
            return (
              <tr key={node.id}>
                {renamingId === node.id ? (
                  <td
                    className="px-3 py-2"
                    colSpan={2}
                    style={{ paddingLeft: `calc(0.75rem + ${node.depth * 1.5}rem)` }}
                  >
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
                  </td>
                ) : (
                  <>
                  <td
                    className="px-3 py-2"
                    style={{ paddingLeft: `calc(0.75rem + ${node.depth * 1.5}rem)` }}
                  >
                    <span className={isGroup ? 'text-xl font-semibold whitespace-nowrap' : 'text-base whitespace-nowrap'}>
                      {node.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
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
                      size="icon"
                      type="button"
                      variant="tertiary"
                    >
                      <Feather aria-hidden="true" className="size-4" />
                    </Button>
                    <Button
                      aria-label={`Delete ${node.name}`}
                      onClick={() => setDeletingId(node.id)}
                      size="icon"
                      type="button"
                      variant="tertiary"
                    >
                      <Trash2 aria-hidden="true" className="size-4 text-danger" />
                    </Button>
                    {deletingId === node.id && (
                      <DeleteCategoryDialog node={node} onClose={() => setDeletingId(null)} />
                    )}
                  </td>
                  </>
                )}
              </tr>
            )
          })}
          </tbody>
        </table>
        </div>
        </Card>
        ))}
        </div>
        ))}
        </div>
      )}
    </section>
  )
}

type NodeGroup = { head: CategoryNode, nodes: CategoryNode[] }

const columnGapRem = 1

// Width of a group card in rem: measured from the rendered card when known, otherwise estimated
// from the widest row (indent + name + action icons + padding).
function groupWidthRem(group: NodeGroup, measuredPx: Record<string, number>): number {
  const measured = measuredPx[group.head.id]
  if (measured !== undefined) {
    return measured / 16
  }
  return Math.max(...group.nodes.map((node) =>
    node.depth * 1.5 + node.name.length * (node.parentId === null ? 0.8 : 0.6) + 8))
}

// Packs groups into the most columns that fit the available width, so horizontal space is used
// before vertical. Each group goes to the currently shortest column, keeping list order.
function layoutColumns(
  groups: NodeGroup[],
  availableRem: number,
  measuredPx: Record<string, number>,
): NodeGroup[][] {
  let best: NodeGroup[][] = [groups]
  for (let count = 2; count <= groups.length; count++) {
    const columns: NodeGroup[][] = Array.from({ length: count }, () => [])
    const heights = new Array<number>(count).fill(0)
    for (const group of groups) {
      const shortest = heights.indexOf(Math.min(...heights))
      columns[shortest]?.push(group)
      heights[shortest] = (heights[shortest] ?? 0) + group.nodes.length + 2
    }
    const width = columns.reduce(
      (sum, column) => sum + Math.max(0, ...column.map((group) => groupWidthRem(group, measuredPx))),
      (count - 1) * columnGapRem,
    )
    if (width > availableRem) {
      break
    }
    best = columns
  }
  return best
}

function useElementWidth(): [(element: HTMLElement | null) => void, number] {
  const [width, setWidth] = useState(0)
  const [element, setElement] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (element === null || typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    setWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [element])
  return [setElement, width]
}

// Splits the flat, depth-ordered node list into one array per top-level group.
function groupNodes(nodes: CategoryNode[]): NodeGroup[] {
  const groups: NodeGroup[] = []
  for (const node of nodes) {
    const current = groups.at(-1)
    if (node.parentId === null || current === undefined) {
      groups.push({ head: node, nodes: [node] })
    } else {
      current.nodes.push(node)
    }
  }
  return groups
}
