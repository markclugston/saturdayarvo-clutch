import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { createFamily, getFamilies } from './api'
import { FamilyPage } from './FamilyPage'

vi.mock('./api', () => ({
  createFamily: vi.fn(),
  getFamilies: vi.fn(),
}))

describe('FamilyPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates a Family through the accessible keyboard flow', async () => {
    const user = userEvent.setup()
    const onReady = vi.fn()
    vi.mocked(getFamilies).mockResolvedValue([])
    vi.mocked(createFamily).mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      ownerUserId: 'owner-id',
    })

    renderWithQueryClient(<FamilyPage onReady={onReady} />)

    expect(await screen.findByRole('heading', { name: 'Create your Family' })).toHaveFocus()
    const createButton = await screen.findByRole('button', { name: 'Create Family' })
    await user.tab()
    expect(createButton).toHaveFocus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce())
    expect(createFamily).toHaveBeenCalledOnce()
  })

  it('opens the accounts view with the named navigation button', async () => {
    const user = userEvent.setup()
    const onReady = vi.fn()
    vi.mocked(getFamilies).mockResolvedValue([{
      id: '550e8400-e29b-41d4-a716-446655440000',
      ownerUserId: 'owner-id',
    }])

    renderWithQueryClient(<FamilyPage onReady={onReady} />)

    const viewAccountsButton = await screen.findByRole('button', { name: 'View accounts' })
    expect(viewAccountsButton.tagName).toBe('BUTTON')
    await user.click(viewAccountsButton)

    expect(onReady).toHaveBeenCalledOnce()
  })
})
