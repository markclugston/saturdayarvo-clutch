import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditStatus } from '@/lib/api/schemas'
import { getEditStatus } from './api'
import { useAssetEditStatus, type HeldEdit } from './useAssetEditStatus'

vi.mock('./api', () => ({ getEditStatus: vi.fn() }))

const assetId = '550e8400-e29b-41d4-a716-446655440000'
const editId = '550e8400-e29b-41d4-a716-446655440002'
const otherId = '550e8400-e29b-41d4-a716-446655440003'

const active: EditStatus = {
  assetId,
  availability: 'Blocked',
  activeEdit: { id: editId, expiresAtUtc: '2026-11-27T12:05:00Z' },
  watchedEdit: { id: editId, state: 'Active', expiresAtUtc: '2026-11-27T12:05:00Z' },
}
const available: EditStatus = { assetId, availability: 'Available', activeEdit: null, watchedEdit: null }

const watched = (watchedEdit: NonNullable<EditStatus['watchedEdit']>): EditStatus =>
  ({ assetId, availability: 'Available', activeEdit: null, watchedEdit })

// A server clock one hour ahead of this one: only the server's own difference may be used.
function lease(secondsLeft = 300): HeldEdit {
  const server = Date.now() + 3_600_000
  return {
    editId,
    serverTimeUtc: new Date(server).toISOString(),
    expiresAtUtc: new Date(server + secondsLeft * 1000).toISOString(),
    receivedAt: Date.now(),
  }
}

describe('useAssetEditStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    vi.mocked(getEditStatus).mockReset().mockResolvedValue(active)
    focusManager.setFocused(true)
    onlineManager.setOnline(true)
  })
  afterEach(() => {
    focusManager.setFocused(undefined)
    onlineManager.setOnline(true)
    vi.useRealTimers()
  })

  // The query client delivers results on a following timer tick, so let that run too.
  const wait = async (ms = 0) => {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
    await act(async () => { await vi.advanceTimersByTimeAsync(5) })
  }
  const calls = () => vi.mocked(getEditStatus).mock.calls.length

  async function render(options: { lease?: HeldEdit; enabled?: boolean } = { lease: lease() }) {
    const client = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children)
    const view = renderHook((props: typeof options) => useAssetEditStatus(assetId, props), {
      initialProps: options, wrapper,
    })
    await wait()
    return view
  }

  it('checks at once and then every 2 s', async () => {
    await render()
    expect(calls()).toBe(1)
    expect(getEditStatus).toHaveBeenLastCalledWith(assetId, editId, expect.any(AbortSignal))

    await wait(2000)
    await wait(2000)

    expect(calls()).toBe(3)
  })

  it('watches no edit while blocked', async () => {
    vi.mocked(getEditStatus).mockResolvedValue(available)
    const { result } = await render({})

    expect(getEditStatus).toHaveBeenLastCalledWith(assetId, undefined, expect.any(AbortSignal))
    expect(result.current.fresh).toBe(true)
    expect(result.current.status?.availability).toBe('Available')
    expect(result.current.lifecycle).toBeNull()
  })

  it.each([
    ['focus', () => focusManager.setFocused(false), () => focusManager.setFocused(true)],
    ['the network', () => onlineManager.setOnline(false), () => onlineManager.setOnline(true)],
  ])('stops without %s and stays unvalidated until one check succeeds', async (_label, lose, regain) => {
    const { result } = await render()
    expect(result.current.validated).toBe(true)

    act(() => lose())
    await wait(10_000)
    expect(calls()).toBe(1)
    expect(result.current.validated).toBe(false)

    vi.mocked(getEditStatus).mockRejectedValueOnce(new TypeError('offline'))
    await act(async () => { regain() })
    await wait()
    expect(result.current.isError).toBe(true)
    expect(result.current.validated).toBe(false)
    expect(result.current.fresh).toBe(false)

    await wait(2000)
    expect(result.current.isError).toBe(false)
    expect(result.current.validated).toBe(true)
    expect(result.current.fresh).toBe(true)
  })

  it('revalidates when the window regains focus', async () => {
    const { result } = await render()
    let answer: (status: EditStatus) => void = () => {}
    vi.mocked(getEditStatus).mockReturnValue(new Promise((resolve) => { answer = resolve }))

    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await wait()

    expect(result.current.validated).toBe(false)
    await act(async () => { answer(active) })
    await wait()
    expect(result.current.validated).toBe(true)
  })

  it('bounds each request to 2 s', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')

    await render()

    expect(timeout).toHaveBeenCalledWith(2000)
  })

  it('reports a failed check as an error, never as available, and clears it on the next success', async () => {
    vi.mocked(getEditStatus).mockResolvedValueOnce(active)
      .mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'))
    const { result } = await render({})

    await wait(2000)
    expect(result.current.isError).toBe(true)
    expect(result.current.fresh).toBe(false)
    expect(result.current.status?.availability).toBe('Blocked')
    // A poll failing in the foreground does not undo the earlier validation.
    expect(result.current.validated).toBe(true)

    await wait(2000)
    expect(result.current.isError).toBe(false)
  })

  it('latches an ended edit, names who ended it and stops polling', async () => {
    vi.mocked(getEditStatus).mockResolvedValue(watched({
      id: editId, state: 'Ended', endedAtUtc: '2026-11-27T12:01:00Z',
      endedBy: { userId: 'u', userName: 'owner@example.test' },
    }))
    const { result } = await render()

    await wait(10_000)

    expect(result.current.lifecycle).toEqual({ kind: 'ended', userName: 'owner@example.test' })
    expect(calls()).toBe(1)
  })

  it.each([
    ['Expired', 'expired'],
    ['Saved', 'inactive'],
    ['Released', 'inactive'],
    ['Unavailable', 'inactive'],
  ] as const)('reports a %s edit as %s', async (state, kind) => {
    vi.mocked(getEditStatus).mockResolvedValue(watched({ id: editId, state }))

    const { result } = await render()

    expect(result.current.lifecycle).toEqual({ kind })
  })

  it('reports nothing while the held edit is active', async () => {
    const { result } = await render()

    expect(result.current.lifecycle).toBeNull()
  })

  it('expires from the server time difference without any poll', async () => {
    const { result } = await render({ lease: lease(10), enabled: false })

    await wait(9_000)
    expect(result.current.lifecycle).toBeNull()
    await wait(1_100)

    expect(result.current.lifecycle).toEqual({ kind: 'expired' })
    expect(calls()).toBe(0)
  })

  it('forgets one edit’s expiry when another is held', async () => {
    const first = lease(1)
    const view = await render({ lease: first, enabled: false })
    await wait(1_100)

    view.rerender({ lease: { ...lease(300), editId: otherId }, enabled: false })

    expect(view.result.current.lifecycle).toBeNull()
  })

  it('stops checking once unmounted', async () => {
    const { unmount } = await render()
    unmount()

    await wait(10_000)

    expect(calls()).toBe(1)
  })
})
