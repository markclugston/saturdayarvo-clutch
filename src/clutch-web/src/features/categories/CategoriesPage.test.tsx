import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/client'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import {
  categoryNodesQueryKey,
  createCategoryNode,
  deleteCategoryNode,
  getCategoryNodes,
  getDeletionImpact,
  renameCategoryNode,
} from './api'
import { CategoriesPage } from './CategoriesPage'

vi.mock('./api', () => ({
  categoryNodesQueryKey: ['category-nodes'],
  createCategoryNode: vi.fn(),
  deleteCategoryNode: vi.fn(),
  getCategoryNodes: vi.fn(),
  getDeletionImpact: vi.fn(),
  renameCategoryNode: vi.fn(),
}))

const food = { id: 'g1', parentId: null, name: 'Food', depth: 0 }
const groceries = { id: 'c1', parentId: 'g1', name: 'Groceries', depth: 1 }
const tree = [
  food,
  groceries,
  { id: 'c2', parentId: 'c1', name: 'Produce', depth: 2 },
  { id: 'g2', parentId: null, name: 'Home', depth: 0 },
]

describe('CategoriesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getCategoryNodes).mockResolvedValue(tree)
  })

  it('shows an empty state when there are no items', async () => {
    vi.mocked(getCategoryNodes).mockResolvedValue([])
    renderWithQueryClient(<CategoriesPage />)
    expect(await screen.findByText(/no groups or categories yet/i)).toBeInTheDocument()
  })

  it('renders groups larger than categories, indented, with gaps between groups', async () => {
    renderWithQueryClient(<CategoriesPage />)

    const list = within(await screen.findByRole('list', { name: 'Groups and categories' }))
    const group = list.getByText('Food')
    const category = list.getByText('Groceries')
    expect(group).toHaveClass('text-xl')
    expect(category).not.toHaveClass('text-xl')
    expect(list.getByText('Home').closest('li')).toHaveClass('mt-6')
    expect(category.closest('li')).not.toHaveClass('mt-6')
    expect(list.getByText('Produce').closest('li')).toHaveStyle({ paddingLeft: '3rem' })
  })

  it('offers an indented parent dropdown with a none option and creates a group', async () => {
    const user = userEvent.setup()
    vi.mocked(createCategoryNode).mockResolvedValue(food)
    renderWithQueryClient(<CategoriesPage />)

    const select = await screen.findByLabelText('Parent')
    const options = Array.from(select.querySelectorAll('option')).map((option) => option.value)
    expect(options).toEqual(['', 'g1', 'c1', 'c2', 'g2'])
    expect(select.querySelector('option')).toHaveTextContent('None (create a group)')

    await user.type(screen.getByLabelText('Name'), 'Travel')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(createCategoryNode).toHaveBeenCalledWith('Travel', null))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''))
  })

  it('creates a category under the chosen parent and surfaces duplicate errors', async () => {
    const user = userEvent.setup()
    vi.mocked(createCategoryNode).mockRejectedValue(new ApiError(409, {
      title: 'Duplicate',
      detail: 'A sibling with that name already exists.',
      status: 409,
    }))
    renderWithQueryClient(<CategoriesPage />)

    await user.selectOptions(await screen.findByLabelText('Parent'), 'g1')
    await user.type(screen.getByLabelText('Name'), 'Groceries')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(createCategoryNode).toHaveBeenCalledWith('Groceries', 'g1'))
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
  })

  it('renames an item', async () => {
    const user = userEvent.setup()
    vi.mocked(renameCategoryNode).mockResolvedValue(groceries)
    renderWithQueryClient(<CategoriesPage />)

    await user.click(await screen.findByRole('button', { name: 'Rename Groceries' }))
    const input = screen.getByLabelText('New name for Groceries')
    await user.clear(input)
    await user.type(input, 'Supermarket')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(renameCategoryNode).toHaveBeenCalledWith('c1', 'Supermarket'))
  })

  it('manages focus for the delete dialog and Escape', async () => {
    const user = userEvent.setup()
    vi.mocked(getDeletionImpact).mockResolvedValue({ itemCount: 3 })
    renderWithQueryClient(<CategoriesPage />)

    const trigger = await screen.findByRole('button', { name: 'Delete Food' })
    await user.click(trigger)
    const cancel = await screen.findByRole('button', { name: 'Cancel' })
    expect(cancel).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the Rename button after saving or cancelling a rename', async () => {
    const user = userEvent.setup()
    vi.mocked(renameCategoryNode).mockResolvedValue(groceries)
    renderWithQueryClient(<CategoriesPage />)

    await user.click(await screen.findByRole('button', { name: 'Rename Groceries' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Rename Groceries' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Rename Groceries' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Rename Groceries' })).toHaveFocus())
  })

  it('returns to the empty state after deleting the last group', async () => {
    const user = userEvent.setup()
    const onlyGroup = { id: 'g9', parentId: null, name: 'Solo', depth: 0 }
    vi.mocked(getCategoryNodes)
      .mockResolvedValueOnce([onlyGroup])
      .mockResolvedValue([])
    vi.mocked(getDeletionImpact).mockResolvedValue({ itemCount: 1 })
    vi.mocked(deleteCategoryNode).mockResolvedValue(undefined)
    renderWithQueryClient(<CategoriesPage />)

    await user.click(await screen.findByRole('button', { name: 'Delete Solo' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('This will permanently delete Solo.')
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText(/no groups or categories yet/i)).toBeInTheDocument()
    expect(deleteCategoryNode).toHaveBeenCalledWith('g9')
  })

  it('warns before deleting, naming descendants, and only deletes after confirmation', async () => {
    const user = userEvent.setup()
    vi.mocked(getDeletionImpact).mockResolvedValue({ itemCount: 3 })
    vi.mocked(deleteCategoryNode).mockResolvedValue(undefined)
    renderWithQueryClient(<CategoriesPage />)

    await user.click(await screen.findByRole('button', { name: 'Delete Food' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(await screen.findByText(/and 2 categories inside it/)).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Do you want to continue?')
    expect(deleteCategoryNode).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deleteCategoryNode).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete Food' }))
    await screen.findByText(/and 2 categories inside it/)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleteCategoryNode).toHaveBeenCalledWith('g1'))
    expect(categoryNodesQueryKey).toEqual(['category-nodes'])
  })
})
