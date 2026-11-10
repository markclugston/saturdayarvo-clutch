import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { getImportLimits, updateImportLimits } from './api'
import { ImportLimitsPage } from './ImportLimitsPage'

vi.mock('./api', () => ({
  getImportLimits: vi.fn(),
  updateImportLimits: vi.fn(),
}))

const defaultLimits = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxRowsPerImport: 10_000,
  maxImportAttemptsPerUserPerMinute: 5,
}

describe('ImportLimitsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getImportLimits).mockResolvedValue(defaultLimits)
    vi.mocked(updateImportLimits).mockImplementation(async (limits) => limits)
  })

  it('displays effective defaults and saves validated shared settings', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<ImportLimitsPage onBack={vi.fn()} />)

    expect(await screen.findByLabelText('Maximum file size (bytes)'))
      .toHaveValue(10 * 1024 * 1024)
    expect(screen.getByLabelText('Maximum rows per import')).toHaveValue(10_000)
    expect(
      screen.getByLabelText('Maximum attempts per user per minute'),
    ).toHaveValue(5)

    await user.clear(screen.getByLabelText('Maximum rows per import'))
    await user.type(screen.getByLabelText('Maximum rows per import'), '20000')
    await user.click(screen.getByRole('button', { name: 'Save limits' }))

    await waitFor(() => {
      expect(updateImportLimits).toHaveBeenCalledOnce()
      expect(vi.mocked(updateImportLimits).mock.calls[0]?.[0]).toEqual({
        ...defaultLimits,
        maxRowsPerImport: 20_000,
      })
    })
  })

  it('blocks non-positive values before submitting', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<ImportLimitsPage onBack={vi.fn()} />)

    const rowLimit = await screen.findByLabelText('Maximum rows per import')
    await user.clear(rowLimit)
    await user.type(rowLimit, '0')
    await user.click(screen.getByRole('button', { name: 'Save limits' }))

    expect(rowLimit).toBeInvalid()
    expect(updateImportLimits).not.toHaveBeenCalled()
  })

  it('returns to the application with its named button', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderWithQueryClient(<ImportLimitsPage onBack={onBack} />)

    await screen.findByRole('heading', { name: 'Import limits' })
    const backButton = screen.getByRole('button', { name: 'Back to the application' })
    expect(backButton).toHaveFocus()
    expect(backButton.tagName).toBe('BUTTON')
    await user.click(backButton)

    expect(onBack).toHaveBeenCalledOnce()
  })
})
