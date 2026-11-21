import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { focusManager, onlineManager } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAccount, getCurrencies } from '@/features/accounts/api'
import { ApiError } from '@/lib/api/client'
import type { ImportStatus } from '@/lib/api/schemas'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import {
  cancelActiveImportReview,
  cancelImportReview,
  confirmImportReview,
  createImportReview,
  getAccountImportSettings,
  getImportStatus,
  type ImportMapping,
} from './api'
import { ImportPage } from './ImportPage'

vi.mock('@/features/accounts/api', () => ({
  getAccount: vi.fn(),
  getCurrencies: vi.fn(),
}))

vi.mock('./api', () => ({
  cancelActiveImportReview: vi.fn(),
  cancelImportReview: vi.fn(),
  confirmImportReview: vi.fn(),
  createImportReview: vi.fn(),
  getAccountImportSettings: vi.fn(),
  getImportStatus: vi.fn(),
}))

const account = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  description: 'Everyday spending',
  currencyCode: 'AUD',
  lastSuccessfulImportAtUtc: null,
}

const currency = {
  code: 'AUD',
  name: 'Australian Dollar',
  amountFormats: [
    {
      id: 'dot-decimal-comma-grouping',
      decimalSeparator: '.',
      groupSeparator: ',',
      reference: 'CLDR',
      version: '44.0',
    },
    {
      id: 'comma-decimal-dot-grouping',
      decimalSeparator: ',',
      groupSeparator: '.',
      reference: 'CLDR',
      version: '44.0',
    },
  ],
}

const savedMapping: ImportMapping = {
  dateColumn: 0,
  descriptionColumn: 1,
  dateFormat: 'yyyy-MM-dd',
  amountMode: 'Signed',
  signedAmountColumn: 2,
  incomingSign: 'Positive',
  numberFormat: 'dot-decimal-comma-grouping',
}

async function showOwnReview(onBack = vi.fn()) {
  vi.mocked(getAccountImportSettings).mockResolvedValue({ mapping: savedMapping })
  const rendered = renderWithQueryClient(<ImportPage accountId={account.id} onBack={onBack} />)
  const user = userEvent.setup()
  await user.upload(await screen.findByLabelText('CSV File'),
    new File(['Date,Description,Amount\n2026-01-15,Market,10.00'], 'transactions.csv', { type: 'text/csv' }))
  await user.click(await screen.findByRole('button', { name: 'Review Import with Saved Settings' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm Import' })).toBeEnabled())
  return { ...rendered, user }
}

describe('ImportPage', () => {
  afterEach(() => {
    focusManager.setFocused(undefined)
    onlineManager.setOnline(true)
  })

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getAccount).mockResolvedValue(account)
    vi.mocked(getCurrencies).mockResolvedValue([currency])
    vi.mocked(getAccountImportSettings).mockResolvedValue({ mapping: null })
    vi.mocked(getImportStatus).mockImplementation(async (accountId, watchedId) => watchedId ? ({
      accountId, availability: 'Blocked',
      activeImport: { id: watchedId, stage: 'Preview', canEnd: true, expiresAtUtc: '2027-01-15T14:00:00Z' },
      watchedImport: { id: watchedId, state: 'Ready', expiresAtUtc: '2027-01-15T14:00:00Z' },
    }) : ({
      accountId, availability: 'Available', activeImport: null, watchedImport: null,
    }))
    vi.mocked(createImportReview).mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440002',
      accountId: account.id,
      currencyCode: 'AUD',
      rowCount: 1,
      duplicateConfirmationRequired: false,
      expiresAtUtc: '2025-01-15T14:00:00.000Z',
      rows: [{
        sourceRowNumber: 2,
        transactionDate: '2025-01-15',
        description: 'Market',
        amount: '1234.50',
        direction: 'Outgoing',
        isPossibleDuplicate: false,
      }],
    })
    vi.mocked(cancelImportReview).mockResolvedValue(undefined)
    vi.mocked(cancelActiveImportReview).mockResolvedValue(undefined)
    vi.mocked(confirmImportReview).mockResolvedValue({
      importedCount: 1,
      completedAtUtc: '2025-01-15T13:50:00.000Z',
      settingsSaved: true,
    })
  })

  it('checks availability before file selection and never interprets a pending read as available', async () => {
    vi.mocked(getImportStatus).mockReturnValue(new Promise(() => {}))
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    expect(await screen.findByText('Checking Import Availability…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled()
    expect(createImportReview).not.toHaveBeenCalled()
  })

  it('shows status errors with Retry and remains blocked until a successful check', async () => {
    vi.mocked(getImportStatus).mockRejectedValueOnce(new Error('Network failed'))
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    const retry = await screen.findByRole('button', { name: 'Retry Availability Check' })
    expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled()
    await user.click(retry)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled())
    expect(createImportReview).not.toHaveBeenCalled()
  })

  it('surfaces a bounded status timeout without treating it as availability', async () => {
    vi.mocked(getImportStatus).mockImplementation((_accountId, _reviewId, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    expect(await screen.findByText('Checking Import Availability…')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Retry Availability Check' }, { timeout: 3500 })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled()
    expect(createImportReview).not.toHaveBeenCalled()
  })

  it('shows checking feedback while retrying a failed refresh with cached availability', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled())
    vi.mocked(getImportStatus).mockRejectedValueOnce(new Error('Network failed'))
      .mockReturnValueOnce(new Promise(() => {}))
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['importStatus', account.id] }) })
    await user.click(await screen.findByRole('button', { name: 'Retry Availability Check' }))
    expect(await screen.findByRole('button', { name: 'Checking Import Availability…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled()
  })

  it('retains a selected file and validated controls while a background recheck is pending', async () => {
    vi.mocked(getAccountImportSettings).mockResolvedValue({ mapping: savedMapping })
    const user = userEvent.setup()
    const { queryClient } = renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled())
    let release = () => {}
    vi.mocked(getImportStatus).mockReturnValueOnce(new Promise((resolve) => {
      release = () => resolve({ accountId: account.id, availability: 'Available', activeImport: null, watchedImport: null })
    }))
    act(() => { void queryClient.invalidateQueries({ queryKey: ['importStatus', account.id] }) })
    const file = new File(['Date,Description,Amount\n2026-01-15,Market,10.00'], 'selected.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText('CSV File'), { target: { files: [file] } })
    expect(await screen.findByText('Selected file: selected.csv')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review Import with Saved Settings' })).toBeEnabled()
    expect(createImportReview).not.toHaveBeenCalled()
    await act(async () => release())
    await user.click(screen.getByRole('button', { name: 'Review Import with Saved Settings' }))
    expect(createImportReview).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('leaves the UI unchanged during an identical periodic check (preview: %s)', async (preview) => {
    const { container, queryClient } = preview
      ? await showOwnReview()
      : renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    const buttonName = preview ? 'Confirm Import' : 'Choose CSV File'
    const button = await screen.findByRole('button', { name: buttonName })
    await waitFor(() => expect(button).toBeEnabled())
    button.focus()
    const reviewId = '550e8400-e29b-41d4-a716-446655440002'
    const unchanged: ImportStatus = preview ? {
      accountId: account.id, availability: 'Blocked',
      activeImport: { id: reviewId, stage: 'Preview', canEnd: true, expiresAtUtc: '2027-01-15T14:00:00Z' },
      watchedImport: { id: reviewId, state: 'Ready', expiresAtUtc: '2027-01-15T14:00:00Z' },
    } : { accountId: account.id, availability: 'Available', activeImport: null, watchedImport: null }
    let finish = () => {}
    vi.mocked(getImportStatus).mockReturnValueOnce(new Promise((resolve) => {
      finish = () => resolve(unchanged)
    }))
    const requests = vi.mocked(getImportStatus).mock.calls.length
    const mutations: MutationRecord[] = []
    const observer = new MutationObserver((records) => mutations.push(...records))
    observer.observe(container, { attributes: true, childList: true, characterData: true, subtree: true })
    try {
      await waitFor(() => expect(vi.mocked(getImportStatus).mock.calls.length).toBeGreaterThan(requests), { timeout: 3500 })
      expect(button).toBeEnabled()
      expect(button).toHaveFocus()
      expect(screen.queryByText('Checking Import Availability…')).not.toBeInTheDocument()
      await act(async () => finish())
      await waitFor(() => expect(queryClient.isFetching({ queryKey: ['importStatus', account.id] })).toBe(0))
      expect(mutations).toHaveLength(0)
    } finally {
      observer.disconnect()
    }

    vi.mocked(getImportStatus).mockResolvedValue({
      accountId: account.id, availability: 'Blocked',
      activeImport: { id: reviewId, stage: 'Processing', canEnd: false, expiresAtUtc: null },
      watchedImport: preview ? { id: reviewId, state: 'Processing' } : null,
    })
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['importStatus', account.id] }) })
    await waitFor(() => expect(button).toBeDisabled())
    expect(screen.getByText(preview
      ? 'This import is processing transactions. Wait for it to finish.'
      : 'Another import is processing transactions for this account. Wait for it to finish.')).toBeInTheDocument()
    expect(createImportReview).toHaveBeenCalledTimes(preview ? 1 : 0)
  })

  it.each(['Processing', 'Unknown'] as const)('blocks early without end controls during %s', async (stage) => {
    vi.mocked(getImportStatus).mockResolvedValue({
      accountId: account.id, availability: 'Blocked',
      activeImport: { id: '550e8400-e29b-41d4-a716-446655440002', stage, canEnd: false, expiresAtUtc: null },
      watchedImport: null,
    })
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    expect(await screen.findByText(/Another import is/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'End Other Import' })).not.toBeInTheDocument()
    expect(cancelActiveImportReview).not.toHaveBeenCalled()
    expect(createImportReview).not.toHaveBeenCalled()
  })

  it('refreshes a blocked screen automatically without automatically creating an import', async () => {
    vi.mocked(getImportStatus).mockResolvedValueOnce({
      accountId: account.id, availability: 'Blocked',
      activeImport: { id: '550e8400-e29b-41d4-a716-446655440002', stage: 'Processing', canEnd: false, expiresAtUtc: null },
      watchedImport: null,
    })
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await screen.findByText(/Another import is/)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled(), { timeout: 5000 })
    expect(createImportReview).not.toHaveBeenCalled()
  })

  it.each(['focus', 'online'])('requires fresh availability after %s restoration', async (kind) => {
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled())
    const setActive = (active: boolean) => kind === 'focus' ? focusManager.setFocused(active) : onlineManager.setOnline(active)
    act(() => setActive(false))
    vi.mocked(getImportStatus).mockReturnValue(new Promise(() => {}))
    act(() => setActive(true))
    await waitFor(() => expect(vi.mocked(getImportStatus).mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled()
  })

  it('rechecks a stale create conflict instead of offering blind cancellation or automatically retrying', async () => {
    vi.mocked(getAccountImportSettings).mockResolvedValue({ mapping: savedMapping })
    vi.mocked(createImportReview).mockImplementation(async () => {
      vi.mocked(getImportStatus).mockResolvedValue({
        accountId: account.id, availability: 'Blocked',
        activeImport: { id: '550e8400-e29b-41d4-a716-446655440099', stage: 'Processing', canEnd: false, expiresAtUtc: null },
        watchedImport: null,
      })
      throw new ApiError(409, { errors: { code: ['ConcurrentImport'] } })
    })
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(await screen.findByLabelText('CSV File'),
      new File(['Date,Description,Amount\n2026-01-15,Market,10.00'], 'transactions.csv', { type: 'text/csv' }))
    await user.click(await screen.findByRole('button', { name: 'Review Import with Saved Settings' }))
    expect(await screen.findByText(/Another import is processing/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Discard active review' })).not.toBeInTheDocument()
    expect(createImportReview).toHaveBeenCalledTimes(1)
  })

  it('ends the displayed preview only on request, then revalidates before enabling a new import', async () => {
    const target = '550e8400-e29b-41d4-a716-446655440099'
    vi.mocked(getImportStatus).mockResolvedValue({
      accountId: account.id, availability: 'Blocked',
      activeImport: { id: target, stage: 'Preview', canEnd: true, expiresAtUtc: '2027-01-15T14:00:00Z' },
      watchedImport: null,
    })
    let releaseCheck = () => {}
    vi.mocked(cancelActiveImportReview).mockImplementation(async () => {
      vi.mocked(getImportStatus).mockReturnValue(new Promise((resolve) => {
        releaseCheck = () => resolve({ accountId: account.id, availability: 'Available', activeImport: null, watchedImport: null })
      }))
    })
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    const end = await screen.findByRole('button', { name: 'End Other Import' })
    expect(cancelActiveImportReview).not.toHaveBeenCalled()
    await user.click(end)
    await waitFor(() => expect(cancelActiveImportReview).toHaveBeenCalledWith(account.id, target))
    expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled()
    await waitFor(() => expect(vi.mocked(getImportStatus).mock.calls.length).toBeGreaterThanOrEqual(2))
    vi.mocked(getImportStatus).mockResolvedValue({ accountId: account.id, availability: 'Available', activeImport: null, watchedImport: null })
    await act(async () => releaseCheck())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled())
    expect(createImportReview).not.toHaveBeenCalled()
  })

  it('keeps a replacement protected and reports a failed end with a retry path', async () => {
    const target = '550e8400-e29b-41d4-a716-446655440099'
    vi.mocked(getImportStatus).mockResolvedValue({
      accountId: account.id, availability: 'Blocked',
      activeImport: { id: target, stage: 'Preview', canEnd: true, expiresAtUtc: '2027-01-15T14:00:00Z' },
      watchedImport: null,
    })
    vi.mocked(cancelActiveImportReview).mockImplementation(async () => {
      vi.mocked(getImportStatus).mockResolvedValue({
        accountId: account.id, availability: 'Blocked',
        activeImport: { id: '550e8400-e29b-41d4-a716-446655440088', stage: 'Processing', canEnd: false, expiresAtUtc: null },
        watchedImport: null,
      })
      throw new ApiError(409, { detail: 'The import changed. Check its current status.', errors: { code: ['ImportChanged'] } })
    })
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'End Other Import' }))
    expect(await screen.findByText('The import changed. Check its current status.')).toBeInTheDocument()
    expect(await screen.findByText(/Another import is processing/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'End Other Import' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Retry Availability Check' })).toBeInTheDocument()
  })

  it('latches the ended notice despite a replacement and stops polling until acknowledgement', async () => {
    const onBack = vi.fn()
    const { user, queryClient } = await showOwnReview(onBack)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const watchedId = '550e8400-e29b-41d4-a716-446655440002'
    vi.mocked(getImportStatus).mockResolvedValue({
      accountId: account.id, availability: 'Blocked',
      activeImport: { id: '550e8400-e29b-41d4-a716-446655440099', stage: 'Processing', canEnd: false, expiresAtUtc: null },
      watchedImport: { id: watchedId, state: 'Ended', endedAtUtc: '2026-11-17T09:00:00Z', endedBy: { userId: 'owner', userName: 'owner@example.test' } },
    })
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['importStatus', account.id] }) })
    expect(await screen.findByRole('dialog', { name: 'Import Ended' })).toHaveTextContent('owner@example.test')
    expect(screen.queryByRole('button', { name: 'Confirm Import' })).not.toBeInTheDocument()
    const reads = vi.mocked(getImportStatus).mock.calls.length
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['importStatus', account.id] }) })
    expect(getImportStatus).toHaveBeenCalledTimes(reads)
    expect(onBack).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Return to Transactions' }))
    await waitFor(() => expect(onBack).toHaveBeenCalledOnce())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['account', account.id] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['transactions', account.id] })
    expect(cancelImportReview).not.toHaveBeenCalled()
  })

  it.each(['Expired', 'Unavailable'] as const)('explains %s without an actor and returns without cancellation', async (state) => {
    const onBack = vi.fn()
    const { user, queryClient } = await showOwnReview(onBack)
    vi.mocked(getImportStatus).mockResolvedValue({
      accountId: account.id, availability: 'Available', activeImport: null,
      watchedImport: { id: '550e8400-e29b-41d4-a716-446655440002', state },
    })
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['importStatus', account.id] }) })
    expect(await screen.findByText(state === 'Expired' ? 'This import preview has expired.' : 'This import preview is no longer available.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm Import' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Return to Transactions' }))
    await waitFor(() => expect(onBack).toHaveBeenCalledOnce())
    expect(cancelImportReview).not.toHaveBeenCalled()
  })

  it('refreshes ImportEndedElsewhere and does not retry confirmation', async () => {
    const { user } = await showOwnReview()
    vi.mocked(confirmImportReview).mockImplementation(async () => {
      vi.mocked(getImportStatus).mockResolvedValue({
        accountId: account.id, availability: 'Available', activeImport: null,
        watchedImport: { id: '550e8400-e29b-41d4-a716-446655440002', state: 'Ended', endedAtUtc: '2026-11-17T09:00:00Z', endedBy: { userId: 'owner', userName: 'owner@example.test' } },
      })
      throw new ApiError(409, { errors: { code: ['ImportEndedElsewhere'] } })
    })
    await user.click(screen.getByRole('button', { name: 'Confirm Import' }))
    expect(await screen.findByRole('dialog', { name: 'Import Ended' })).toBeVisible()
    expect(confirmImportReview).toHaveBeenCalledTimes(1)
  })

  it('explains a protected watched preview after foreground restoration', async () => {
    await showOwnReview()
    act(() => focusManager.setFocused(false))
    vi.mocked(getImportStatus).mockResolvedValue({
      accountId: account.id, availability: 'Blocked',
      activeImport: { id: '550e8400-e29b-41d4-a716-446655440002', stage: 'Processing', canEnd: false, expiresAtUtc: null },
      watchedImport: { id: '550e8400-e29b-41d4-a716-446655440002', state: 'Processing' },
    })
    act(() => focusManager.setFocused(true))
    expect(await screen.findByText('This import is processing transactions. Wait for it to finish.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm Import' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel Review' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'End Other Import' })).not.toBeInTheDocument()
    expect(createImportReview).toHaveBeenCalledTimes(1)
    expect(confirmImportReview).not.toHaveBeenCalled()
  })

  it('preserves an unknown confirmation outcome when the watched review is unavailable', async () => {
    const { user } = await showOwnReview()
    vi.mocked(confirmImportReview).mockImplementation(async () => {
      vi.mocked(getImportStatus).mockResolvedValue({
        accountId: account.id, availability: 'Available', activeImport: null,
        watchedImport: { id: '550e8400-e29b-41d4-a716-446655440002', state: 'Unavailable' },
      })
      throw new ApiError(503, {
        detail: 'The import outcome could not be established. Check transactions before trying again.',
        errors: { code: ['ImportOutcomeUnknown'] },
      })
    })
    await user.click(screen.getByRole('button', { name: 'Confirm Import' }))
    expect(await screen.findByText('The import outcome could not be established. Check transactions before trying again.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm Import' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return to Transactions' })).toBeEnabled()
    expect(confirmImportReview).toHaveBeenCalledTimes(1)
  })

  it('displays the safe row and field from an import validation error', async () => {
    vi.mocked(createImportReview).mockRejectedValue(new ApiError(400, {
      detail: 'A transaction date does not match the selected date format.',
      errors: { rowNumber: ['2'], field: ['TransactionDate'] },
    }))
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV File'),
      new File(['Date,Description,Amount\n15/01/2025,Market,10.00'], 'transactions.csv', {
        type: 'text/csv',
      }),
    )
    await user.selectOptions(await screen.findByLabelText('Transaction Date Column'), '0')
    await user.selectOptions(screen.getByLabelText('Description Column'), '1')
    await user.selectOptions(screen.getByLabelText('Date Format'), 'yyyy-MM-dd')
    await user.selectOptions(screen.getByLabelText('Signed Amount Column'), '2')
    await user.selectOptions(screen.getByLabelText('Incoming Transactions Use'), 'Positive')
    await user.selectOptions(
      screen.getByLabelText('Number Format Used in This File'),
      'dot-decimal-comma-grouping',
    )
    await user.click(screen.getByRole('button', { name: 'Review Import' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A transaction date does not match the selected date format. (Row 2, field: TransactionDate)',
    )
  })

  it('maps, reviews, and explicitly confirms a CSV import', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)

    await screen.findByRole('heading', { name: 'Import Transactions' })
    expect(screen.getByRole('button', { name: 'Back to Account' })).toHaveFocus()
    expect(await screen.findByRole('button', { name: 'Choose CSV File' })).toBeInTheDocument()
    await user.upload(
      await screen.findByLabelText('CSV File'),
      new File(
        ['Date,Description,Amount\n2025-01-15,Market,-1234.50'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )

    await user.selectOptions(await screen.findByLabelText('Transaction Date Column'), '0')
    await user.selectOptions(screen.getByLabelText('Description Column'), '1')
    await user.selectOptions(screen.getByLabelText('Date Format'), 'yyyy-MM-dd')
    await user.selectOptions(screen.getByLabelText('Signed Amount Column'), '2')
    await user.selectOptions(screen.getByLabelText('Incoming Transactions Use'), 'Positive')
    await user.selectOptions(
      screen.getByLabelText('Number Format Used in This File'),
      'dot-decimal-comma-grouping',
    )
    await user.click(screen.getByRole('button', { name: 'Review Import' }))

    await waitFor(() =>
      expect(createImportReview).toHaveBeenCalledWith(
        account.id,
        expect.any(File),
        {
          dateColumn: 0,
          descriptionColumn: 1,
          dateFormat: 'yyyy-MM-dd',
          amountMode: 'Signed',
          numberFormat: 'dot-decimal-comma-grouping',
          signedAmountColumn: 2,
          incomingSign: 'Positive',
        },
      ),
    )
    expect(await screen.findByText('Market')).toBeInTheDocument()
    expect(screen.getByText(formatCurrencyAmount('1234.50', 'AUD'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm Import' }))

    await waitFor(() =>
      expect(confirmImportReview).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440002',
        false,
      ),
    )
    expect(await screen.findByText('1 transactions imported successfully.'))
      .toBeInTheDocument()
  })

  it('uses saved defaults without showing the mapping form until requested', async () => {
    vi.mocked(getAccountImportSettings).mockResolvedValue({ mapping: savedMapping })
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV File'),
      new File(
        ['Date,Description,Amount\n2025-01-15,Market,-10.00'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Using this account’s saved import settings.',
    )
    expect(screen.queryByRole('heading', { name: 'Map CSV Columns' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Review Import with Saved Settings' }))
    await waitFor(() => expect(createImportReview).toHaveBeenCalledWith(
      account.id,
      expect.any(File),
      savedMapping,
    ))
  })

  it('shows retrieval failures and keeps the editable settings flow available', async () => {
    vi.mocked(getAccountImportSettings).mockRejectedValue(new ApiError(500, {
      title: 'Saved import settings could not be read.',
    }))
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV File'),
      new File(
        ['Date,Description,Amount\n2025-01-15,Market,-10.00'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Saved import settings could not be retrieved.',
    )
    expect(await screen.findByRole('heading', { name: 'Map CSV Columns' })).toBeInTheDocument()
  })

  it('prefills saved settings and submits edits made before review', async () => {
    vi.mocked(getAccountImportSettings).mockResolvedValue({ mapping: savedMapping })
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV File'),
      new File(
        ['Date,Description,Amount\n15/01/2025,Market,-10.00'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )
    const changeSettingsButton = screen.getByRole('button', { name: 'View or Change Settings' })
    changeSettingsButton.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Transaction Date Column')).toHaveValue('0')
    expect(screen.getByLabelText('Description Column')).toHaveValue('1')
    expect(screen.getByLabelText('Signed Amount Column')).toHaveValue('2')

    await user.selectOptions(screen.getByLabelText('Date Format'), 'dd/MM/yyyy')
    const reviewButton = screen.getByRole('button', { name: 'Review Import' })
    reviewButton.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(createImportReview).toHaveBeenCalledWith(
      account.id,
      expect.any(File),
      { ...savedMapping, dateFormat: 'dd/MM/yyyy' },
    ))
  })

  it('opens saved settings before selecting a file and retains edits for the review', async () => {
    vi.mocked(getAccountImportSettings).mockResolvedValue({ mapping: savedMapping })
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)

    const toggle = await screen.findByRole('button', { name: 'View or Change Settings' })
    await user.click(toggle)
    expect(screen.getByRole('heading', { name: 'Map CSV Columns' })).toBeInTheDocument()
    expect(screen.getByLabelText('Transaction Date Column')).toHaveValue('0')
    expect(screen.getByLabelText('Date Format')).toHaveValue('yyyy-MM-dd')
    expect(screen.getByRole('button', { name: 'Review Import' })).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Date Format'), 'dd/MM/yyyy')

    await user.upload(
      screen.getByLabelText('CSV File'),
      new File(['Date,Description,Amount\n15/01/2025,Market,-10.00'], 'transactions.csv', {
        type: 'text/csv',
      }),
    )
    await waitFor(() => expect(screen.getByLabelText('Transaction Date Column'))
      .toHaveTextContent('1: Date'))
    expect(screen.getByLabelText('Date Format')).toHaveValue('dd/MM/yyyy')
    expect(screen.getByLabelText('Transaction Date Column')).toHaveValue('0')
    await user.click(screen.getByRole('button', { name: 'Review Import' }))
    await waitFor(() => expect(createImportReview).toHaveBeenCalledWith(
      account.id, expect.any(File), { ...savedMapping, dateFormat: 'dd/MM/yyyy' },
    ))
  })

  it('offers an accessible correction path when saved columns do not fit the file', async () => {
    vi.mocked(getAccountImportSettings).mockResolvedValue({
      mapping: { ...savedMapping, signedAmountColumn: 3 },
    })
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV File'),
      new File(
        ['Date,Description,Amount\n2025-01-15,Market,-10.00'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The saved settings do not match this file’s columns.',
    )
    expect(screen.getByRole('heading', { name: 'Map CSV Columns' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review Import' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View or Change Settings' })).not.toBeInTheDocument()
  })

  it('prefills and submits the optional balance column, and allows clearing it', async () => {
    vi.mocked(getAccountImportSettings).mockResolvedValue({
      mapping: { ...savedMapping, balanceColumn: 3 },
    })
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV File'),
      new File(
        ['Date,Description,Amount,Balance\n15/01/2025,Market,-10.00,90.00'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )
    await user.click(screen.getByRole('button', { name: 'View or Change Settings' }))
    expect(screen.getByLabelText('Balance Column (Optional)')).toHaveValue('3')

    await user.click(screen.getByRole('button', { name: 'Review Import' }))
    await waitFor(() => expect(createImportReview).toHaveBeenLastCalledWith(
      account.id,
      expect.any(File),
      { ...savedMapping, balanceColumn: 3 },
    ))
  })

  it('omits the balance column when the user clears the optional selection', async () => {
    vi.mocked(getAccountImportSettings).mockResolvedValue({
      mapping: { ...savedMapping, balanceColumn: 3 },
    })
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV File'),
      new File(
        ['Date,Description,Amount,Balance\n15/01/2025,Market,-10.00,90.00'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )
    await user.click(screen.getByRole('button', { name: 'View or Change Settings' }))
    await user.selectOptions(screen.getByLabelText('Balance Column (Optional)'), '')
    await user.click(screen.getByRole('button', { name: 'Review Import' }))
    await waitFor(() => expect(createImportReview).toHaveBeenLastCalledWith(
      account.id,
      expect.any(File),
      savedMapping,
    ))
  })

  it('flags saved settings whose balance column does not fit the file', async () => {
    vi.mocked(getAccountImportSettings).mockResolvedValue({
      mapping: { ...savedMapping, balanceColumn: 5 },
    })
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV File'),
      new File(
        ['Date,Description,Amount\n2025-01-15,Market,-10.00'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The saved settings do not match this file’s columns.',
    )
  })

  it('distinguishes a successful import from an unsuccessful defaults save', async () => {
    vi.mocked(getAccountImportSettings).mockResolvedValue({ mapping: savedMapping })
    vi.mocked(confirmImportReview).mockResolvedValue({
      importedCount: 1,
      completedAtUtc: '2025-01-15T13:50:00.000Z',
      settingsSaved: false,
    })
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV File'),
      new File(
        ['Date,Description,Amount\n2025-01-15,Market,-10.00'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Review Import with Saved Settings' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm Import' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      '1 transactions imported successfully.',
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The transactions were imported, but the default import settings were not saved.',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Your previous settings remain unchanged.')
  })

  it('requires explicit confirmation to import flagged rows and keeps cancellation available', async () => {
    vi.mocked(createImportReview).mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440003',
      accountId: account.id,
      currencyCode: 'AUD',
      rowCount: 1,
      duplicateConfirmationRequired: true,
      expiresAtUtc: '2025-01-15T14:00:00.000Z',
      rows: [{
        sourceRowNumber: 2,
        transactionDate: '2025-01-15',
        description: 'Market',
        amount: '1234.50',
        direction: 'Outgoing',
        isPossibleDuplicate: true,
      }],
    })

    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV File'),
      new File(
        ['Date,Description,Amount\n2025-01-15,Market,-1234.50'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )
    await user.selectOptions(await screen.findByLabelText('Transaction Date Column'), '0')
    await user.selectOptions(screen.getByLabelText('Description Column'), '1')
    await user.selectOptions(screen.getByLabelText('Date Format'), 'yyyy-MM-dd')
    await user.selectOptions(screen.getByLabelText('Signed Amount Column'), '2')
    await user.selectOptions(screen.getByLabelText('Incoming Transactions Use'), 'Positive')
    await user.selectOptions(
      screen.getByLabelText('Number Format Used in This File'),
      'dot-decimal-comma-grouping',
    )
    await user.click(screen.getByRole('button', { name: 'Review Import' }))

    expect(await screen.findByText(/Confirming will import every valid row/))
      .toBeInTheDocument()
    const confirmButton = screen.getByRole('button', { name: 'Confirm Import' })
    expect(confirmButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel Review' })).toBeEnabled()

    await user.click(screen.getByLabelText(
      /I reviewed the possible duplicates and want to import every valid row/,
    ))
    expect(confirmButton).toBeEnabled()
    await user.click(confirmButton)
    await waitFor(() =>
      expect(confirmImportReview).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440003',
        true,
      ),
    )
  })

  it('cancels a duplicate review without confirming it', async () => {
    vi.mocked(createImportReview).mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440004',
      accountId: account.id,
      currencyCode: 'AUD',
      rowCount: 1,
      duplicateConfirmationRequired: true,
      expiresAtUtc: '2025-01-15T14:00:00.000Z',
      rows: [{
        sourceRowNumber: 2,
        transactionDate: '2025-01-15',
        description: 'Market',
        amount: '1234.50',
        direction: 'Outgoing',
        isPossibleDuplicate: true,
      }],
    })

    const onBack = vi.fn()
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={onBack} />)
    await user.upload(
      await screen.findByLabelText('CSV File'),
      new File(
        ['Date,Description,Amount\n2025-01-15,Market,-1234.50'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )
    await user.selectOptions(await screen.findByLabelText('Transaction Date Column'), '0')
    await user.selectOptions(screen.getByLabelText('Description Column'), '1')
    await user.selectOptions(screen.getByLabelText('Date Format'), 'yyyy-MM-dd')
    await user.selectOptions(screen.getByLabelText('Signed Amount Column'), '2')
    await user.selectOptions(screen.getByLabelText('Incoming Transactions Use'), 'Positive')
    await user.selectOptions(
      screen.getByLabelText('Number Format Used in This File'),
      'dot-decimal-comma-grouping',
    )
    await user.click(screen.getByRole('button', { name: 'Review Import' }))
    await screen.findByText(/Confirming will import every valid row/)
    await user.click(screen.getByRole('button', { name: 'Cancel Review' }))

    await waitFor(() =>
      expect(cancelImportReview).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440004',
      ),
    )
    expect(onBack).toHaveBeenCalledOnce()
    expect(confirmImportReview).not.toHaveBeenCalled()
  })
})
