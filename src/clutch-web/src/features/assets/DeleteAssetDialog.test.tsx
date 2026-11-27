import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assetsQueryKey, deleteAsset } from './api'
import {
  DeleteAssetDialog, DELETE_BLOCKED_MESSAGE, DELETE_FAILED_MESSAGE, DELETE_GONE_MESSAGE,
} from './DeleteAssetDialog'
import { assetId, assetList, refusal, renderAssets } from './testSupport'

vi.mock('./api', async (importActual) => ({
  ...await importActual<typeof import('./api')>(),
  deleteAsset: vi.fn(),
}))

describe('DeleteAssetDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => vi.resetAllMocks())

  function render() {
    const view = renderAssets(
      <DeleteAssetDialog asset={{ id: assetId, name: 'House' }} onClose={onClose} />,
    )
    view.queryClient.setQueryData(assetsQueryKey, assetList)
    return view
  }

  const dialog = () => screen.getByRole('alertdialog')
  const button = (name: string) => within(dialog()).getByRole('button', { name })
  const stale = (view: ReturnType<typeof render>) =>
    view.queryClient.getQueryState(assetsQueryKey)?.isInvalidated

  it('names the asset and offers Delete and Cancel', async () => {
    render()

    expect(dialog()).toHaveTextContent('Delete Asset')
    expect(dialog()).toHaveTextContent('House')
    expect(button('Delete')).toBeEnabled()
    await waitFor(() => expect(button('Cancel')).toHaveFocus())
  })

  it('cancels without deleting', async () => {
    const user = userEvent.setup()
    render()

    await user.click(button('Cancel'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(deleteAsset).not.toHaveBeenCalled()
  })

  it('shows pending at once with both buttons disabled', async () => {
    vi.mocked(deleteAsset).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render()

    await user.click(button('Delete'))

    expect(button('Deleting…')).toBeDisabled()
    expect(button('Cancel')).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('confirms success with a message and refetches the list', async () => {
    vi.mocked(deleteAsset).mockResolvedValue(undefined)
    const user = userEvent.setup()
    const view = render()

    await user.click(button('Delete'))

    expect(await screen.findByText('House was deleted.')).toBeInTheDocument()
    expect(deleteAsset).toHaveBeenCalledWith(assetId)
    expect(onClose).toHaveBeenCalled()
    expect(stale(view)).toBe(true)
  })

  it.each([
    ['an edit elsewhere', refusal(409, 'AssetEditActive'), DELETE_BLOCKED_MESSAGE],
    ['a server error', refusal(500), DELETE_FAILED_MESSAGE],
    ['a network error', new TypeError('offline'), DELETE_FAILED_MESSAGE],
  ])('stays open and explains %s, leaving the list unchanged', async (_label, error, message) => {
    vi.mocked(deleteAsset).mockRejectedValue(error)
    const user = userEvent.setup()
    const view = render()

    await user.click(button('Delete'))

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(message)
    expect(onClose).not.toHaveBeenCalled()
    expect(stale(view)).toBe(false)
    await waitFor(() => expect(button('Delete')).toBeEnabled())
  })

  it('says a missing asset no longer exists and refetches the list', async () => {
    vi.mocked(deleteAsset).mockRejectedValue(refusal(404, 'AssetNotFound'))
    const user = userEvent.setup()
    const view = render()

    await user.click(button('Delete'))

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(DELETE_GONE_MESSAGE)
    expect(button('Close')).toBeEnabled()
    expect(stale(view)).toBe(true)
  })
})
