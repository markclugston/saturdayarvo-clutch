import { act, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePinnedList } from './usePinnedList'

// A panel 600 px high from y = 100 with 20 px padding, so the card stops at y = 120 once the panel
// has scrolled 200 px. The card adds 60 px above a list whose rows are 1000 px high under a 40 px header.
const PANEL_TOP = 100
const PADDING = 20
const STOP_AT_SCROLL = 200
const CHROME = 60
const ROWS = 1000
const HEADER = 40
const CONTROL = 30

type HarnessProps = { scrollable?: boolean, showList?: boolean }

function Harness({ scrollable = true, showList = true }: HarnessProps) {
  const { trackRef, listRef, spacerRef } = usePinnedList()
  const table = createElement(
    'table',
    null,
    createElement('thead', null, createElement('tr', null, createElement('th', null, 'Name'))),
    createElement('tbody', null, createElement('tr', null, createElement(
      'td',
      null,
      createElement('button', { type: 'button' }, 'Row Action'),
    ))),
  )
  const list = createElement(
    'div',
    { 'data-testid': 'list', ref: listRef, tabIndex: 0 },
    createElement('div', { 'data-testid': 'rows' }, table),
  )
  const track = createElement(
    'div',
    { 'data-testid': 'track', ref: trackRef },
    createElement('div', { 'data-testid': 'card' }, list),
    createElement('div', { 'data-testid': 'spacer', ref: spacerRef }),
  )
  return createElement(
    'div',
    {
      'data-testid': 'scroller',
      style: scrollable
        ? { overflowY: 'auto', paddingTop: `${PADDING}px`, paddingBottom: `${PADDING}px` }
        : undefined,
    },
    createElement('div', { 'data-testid': 'content' }, showList ? track : null),
  )
}

let frames: Map<number, FrameRequestCallback>
let resizeCallbacks: Set<() => void>
let observed: Element[]

function runFrames() {
  const pending = [...frames.values()]
  frames.clear()
  act(() => pending.forEach((frame) => frame(0)))
}

function rect(top: number, height: number): DOMRect {
  return { top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }
}

function define(element: Element, properties: Record<string, () => number>) {
  for (const [name, get] of Object.entries(properties)) {
    Object.defineProperty(element, name, { configurable: true, get })
  }
}

/** Gives the rendered elements a layout; the fields of `size` can be changed afterwards. */
function layOut() {
  const scroller = screen.getByTestId('scroller')
  const track = screen.getByTestId('track')
  const card = screen.getByTestId('card')
  const list = screen.getByTestId('list')
  const spacer = screen.getByTestId('spacer')
  const header = list.querySelector('thead')!
  const control = screen.getByRole('button', { name: 'Row Action' })
  const size = { panel: 600, rows: ROWS, controlAt: 100, focusVisible: true }

  let panelScroll = 0
  let listScroll = 0
  const listHeight = () => Math.min(size.rows, parseFloat(list.style.maxHeight) || Number.POSITIVE_INFINITY)
  const hidden = () => size.rows - listHeight()
  const trackTop = () => PANEL_TOP + PADDING + STOP_AT_SCROLL - panelScroll
  const stopAt = PANEL_TOP + PADDING
  const cardTop = () => Math.min(Math.max(trackTop(), stopAt), trackTop() + (parseFloat(spacer.style.height) || 0))
  const listTop = () => cardTop() + CHROME

  define(scroller, { clientHeight: () => size.panel })
  define(card, { offsetHeight: () => CHROME + listHeight() })
  define(list, { offsetHeight: listHeight, clientHeight: listHeight, scrollHeight: () => size.rows })
  Object.defineProperty(scroller, 'scrollTop', {
    configurable: true,
    get: () => panelScroll,
    set: (value: number) => { panelScroll = Math.max(0, value) },
  })
  Object.defineProperty(list, 'scrollTop', {
    configurable: true,
    get: () => Math.min(listScroll, hidden()),
    set: (value: number) => { listScroll = Math.min(Math.max(0, value), hidden()) },
  })
  vi.spyOn(scroller, 'getBoundingClientRect').mockImplementation(() => rect(PANEL_TOP, size.panel))
  vi.spyOn(track, 'getBoundingClientRect').mockImplementation(() => rect(trackTop(), CHROME + listHeight()))
  vi.spyOn(list, 'getBoundingClientRect').mockImplementation(() => rect(listTop(), listHeight()))
  vi.spyOn(header, 'getBoundingClientRect').mockImplementation(() => rect(listTop(), HEADER))
  vi.spyOn(control, 'getBoundingClientRect')
    .mockImplementation(() => rect(listTop() + size.controlAt - list.scrollTop, CONTROL))
  const matches = control.matches.bind(control)
  vi.spyOn(control, 'matches').mockImplementation(
    (selector: string) => (selector === ':focus-visible' ? size.focusVisible : matches(selector)),
  )

  /** The user, or anything else, scrolls the panel. */
  function scrollPanel(to: number) {
    scroller.scrollTop = to
    scroller.dispatchEvent(new Event('scroll'))
    runFrames()
  }

  /** Something other than the hook scrolls the list. */
  function scrollList(to: number) {
    list.scrollTop = to
    list.dispatchEvent(new Event('scroll'))
  }

  runFrames()
  return { scroller, track, card, list, spacer, control, size, scrollPanel, scrollList }
}

describe('usePinnedList', () => {
  beforeEach(() => {
    let nextFrame = 1
    frames = new Map()
    resizeCallbacks = new Set()
    observed = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextFrame++
      frames.set(id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id) })
    vi.stubGlobal('ResizeObserver', class {
      private readonly callback: () => void
      constructor(callback: () => void) { this.callback = callback }
      observe(element: Element) {
        observed.push(element)
        resizeCallbacks.add(this.callback)
      }
      disconnect() { resizeCallbacks.delete(this.callback) }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('limits the list to what the panel can show and makes the spacer as tall as the rows left out', () => {
    render(createElement(Harness))
    const { list, spacer } = layOut()

    // 600 less 40 of padding less 60 of card.
    expect(list.style.maxHeight).toBe('500px')
    expect(spacer.style.height).toBe('500px')
  })

  it('sets those heights with no transition, which the reduced-motion rule would delay by a frame', () => {
    const view = render(createElement(Harness))
    const { list, spacer } = layOut()

    expect(list.style.transitionProperty).toBe('none')
    expect(spacer.style.transitionProperty).toBe('none')

    view.unmount()
    expect(list.style.transitionProperty).toBe('')
    expect(spacer.style.transitionProperty).toBe('')
  })

  it.each([
    [292, '192px', '808px'],
    [291, '', '0px'],
  ])('with a %d px panel limits the list to "%s": a short panel scrolls as before', (panel, limit, height) => {
    render(createElement(Harness))
    const { list, spacer, size } = layOut()

    size.panel = panel
    window.dispatchEvent(new Event('resize'))
    runFrames()

    expect(list.style.maxHeight).toBe(limit)
    expect(spacer.style.height).toBe(height)
  })

  it('adds no space for a list that fits', () => {
    render(createElement(Harness))
    const { list, spacer, size, scrollPanel } = layOut()

    size.rows = 300
    scrollPanel(350)

    expect(spacer.style.height).toBe('0px')
    expect(list.scrollTop).toBe(0)
  })

  it.each([
    ['before the group stops', 0, 0],
    ['as it stops', 200, 0],
    ['while it is stopped', 350, 150],
    ['at the end of the list', 700, 500],
    ['past the end', 900, 500],
  ])('scrolls the list to match the panel %s', (_label, panel, expected) => {
    render(createElement(Harness))
    const { list, scrollPanel } = layOut()

    scrollPanel(panel)

    expect(list.scrollTop).toBe(expected)
  })

  it('returns the list as the panel is scrolled back', () => {
    render(createElement(Harness))
    const { list, scrollPanel } = layOut()
    scrollPanel(600)

    scrollPanel(250)

    expect(list.scrollTop).toBe(50)
  })

  it('starts as soon as a list that mounts later appears', () => {
    const view = render(createElement(Harness, { showList: false }))

    view.rerender(createElement(Harness))
    const { list } = layOut()

    expect(list.style.maxHeight).toBe('500px')
  })

  it('listens passively and updates at most once per animation frame', () => {
    const listen = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    render(createElement(Harness))
    const { scroller, track } = layOut()
    const measure = vi.mocked(track.getBoundingClientRect)
    measure.mockClear()

    scroller.dispatchEvent(new Event('scroll'))
    scroller.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))

    expect(frames.size).toBe(1)
    expect(measure).not.toHaveBeenCalled()
    runFrames()
    expect(measure).toHaveBeenCalledTimes(1)
    expect(listen).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
  })

  it('recomputes when the panel, its content or the list’s rows change size', () => {
    render(createElement(Harness))
    const { scroller, spacer, size } = layOut()

    size.rows = 1400
    resizeCallbacks.forEach((callback) => callback())
    runFrames()

    expect(observed).toEqual([scroller, screen.getByTestId('content'), screen.getByTestId('rows')])
    expect(spacer.style.height).toBe('900px')
  })

  it('moves the panel to match a list that something else scrolled', () => {
    render(createElement(Harness))
    const { scroller, list, scrollPanel, scrollList } = layOut()
    scrollPanel(350)

    scrollList(300)

    expect(scroller.scrollTop).toBe(500)
    expect(list.scrollTop).toBe(300)
  })

  it('leaves the panel alone for the list scrolling the hook did itself', () => {
    render(createElement(Harness))
    const { scroller, list, scrollPanel } = layOut()
    scrollPanel(900)

    list.dispatchEvent(new Event('scroll'))

    expect(scroller.scrollTop).toBe(900)
  })

  it('leaves the panel alone when the list scrolled because its size changed', () => {
    render(createElement(Harness))
    const { scroller, list, spacer, size, scrollPanel } = layOut()
    scrollPanel(700)

    // Rows removed: the browser pulls the list back before the hook has measured again.
    size.rows = 900
    list.dispatchEvent(new Event('scroll'))
    runFrames()

    expect(scroller.scrollTop).toBe(700)
    expect(spacer.style.height).toBe('400px')
    expect(list.scrollTop).toBe(400)
  })

  it.each([
    // Panel at 350: the list shows rows from 150, under its header, to 650.
    ['below what is showing', 350, 800, 530, 330],
    ['under the header', 500, 320, 480, 280],
    ['further down, before the group has stopped', 0, 700, 430, 230],
  ])('shows a control with visible focus that is %s', (_label, panel, controlAt, panelAfter, listAfter) => {
    render(createElement(Harness))
    const { scroller, list, control, size, scrollPanel } = layOut()
    scrollPanel(panel)
    size.controlAt = controlAt

    control.focus()

    // At once, without waiting for a frame.
    expect(scroller.scrollTop).toBe(panelAfter)
    expect(list.scrollTop).toBe(listAfter)
  })

  it('follows the browser when it has already scrolled the list to the focused control', () => {
    render(createElement(Harness))
    const { scroller, list, control, size } = layOut()
    size.controlAt = 700
    list.scrollTop = 230

    control.focus()

    expect(scroller.scrollTop).toBe(430)
    expect(list.scrollTop).toBe(230)
  })

  it.each([
    ['a control that is already showing', 100, true],
    ['focus from the pointer, so nothing moves under it', 800, false],
  ])('does not scroll for %s', (_label, controlAt, focusVisible) => {
    render(createElement(Harness))
    const { scroller, list, control, size } = layOut()
    size.controlAt = controlAt
    size.focusVisible = focusVisible

    control.focus()

    expect(scroller.scrollTop).toBe(0)
    expect(list.scrollTop).toBe(0)
  })

  it('does not scroll when the list itself takes focus', () => {
    render(createElement(Harness))
    const { scroller, list, scrollPanel } = layOut()
    scrollPanel(50)

    list.focus()

    expect(scroller.scrollTop).toBe(50)
  })

  it('does nothing without a page scroller', () => {
    render(createElement(Harness, { scrollable: false }))
    const { list, spacer, control, size, scroller } = layOut()
    size.controlAt = 800

    control.focus()
    window.dispatchEvent(new Event('resize'))

    expect(frames.size).toBe(0)
    expect(resizeCallbacks.size).toBe(0)
    expect(list.style.maxHeight).toBe('')
    expect(spacer.style.height).toBe('')
    expect(scroller.scrollTop).toBe(0)
  })

  it('removes its listeners, observer, pending frame and styles on unmount', () => {
    const view = render(createElement(Harness))
    const { scroller, list, spacer, control, size, scrollPanel } = layOut()
    scrollPanel(350)
    scroller.dispatchEvent(new Event('scroll'))
    expect(frames.size).toBe(1)

    view.unmount()

    expect(frames.size).toBe(0)
    expect(resizeCallbacks.size).toBe(0)
    expect(list.style.maxHeight).toBe('')
    expect(spacer.style.height).toBe('')
    size.controlAt = 800
    scroller.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    list.scrollTop = 10
    list.dispatchEvent(new Event('scroll'))
    control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(frames.size).toBe(0)
    expect(scroller.scrollTop).toBe(350)
  })
})
