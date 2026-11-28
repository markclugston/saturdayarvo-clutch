import { useEffect, useState } from 'react'

/** The least height a stopped list is given, in px. With less room the page scrolls as normal. */
const MIN_LIST_HEIGHT = 192

function findPageScroller(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = window.getComputedStyle(parent)
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent
    }
  }
  return null
}

/**
 * Stops a list's card at the top of the page's scrolling area and moves the rows through it as the
 * page scrolls on, so there is one scrollbar. The card is CSS `sticky` inside the track; the spacer
 * after it is as tall as the rows that do not fit, which is how long the card stays; and the list's
 * own scroll position follows the page's.
 *
 * Pass `trackRef` to the wrapper holding the card then the spacer, `listRef` to the element inside
 * the card holding the rows (`overflow-y: hidden`, with any `thead` sticky), and `spacerRef` to the
 * spacer.
 */
export function usePinnedList() {
  const [track, trackRef] = useState<HTMLDivElement | null>(null)
  const [list, listRef] = useState<HTMLDivElement | null>(null)
  const [spacer, spacerRef] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const scroller = track ? findPageScroller(track) : null
    const card = track?.firstElementChild
    if (!track || !list || !spacer || !scroller || !(card instanceof HTMLElement)) {
      return undefined
    }

    const padding = () => {
      const { paddingTop, paddingBottom } = window.getComputedStyle(scroller)
      return { top: parseFloat(paddingTop) || 0, bottom: parseFloat(paddingBottom) || 0 }
    }
    const hiddenRows = () => list.scrollHeight - list.clientHeight
    /** How far the page has scrolled beyond where the card stops; negative before it gets there. */
    const pastStop = () =>
      scroller.getBoundingClientRect().top + padding().top - track.getBoundingClientRect().top
    const within = (value: number, most: number) => Math.min(Math.max(value, 0), most)

    // What the last update left, to tell the hook's own list scrolling from anyone else's.
    let hidden = 0
    let position = 0

    const update = () => {
      const { top, bottom } = padding()
      const room = scroller.clientHeight - top - bottom - (card.offsetHeight - list.offsetHeight)
      list.style.maxHeight = room >= MIN_LIST_HEIGHT ? `${room}px` : ''
      hidden = hiddenRows()
      spacer.style.height = `${hidden}px`
      list.scrollTop = within(pastStop(), hidden)
      position = list.scrollTop    }

    let frame = 0
    const scheduleUpdate = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(() => {
          frame = 0
          update()
        })
      }
    }

    /** Puts the list at `wanted` by moving the page, which the list follows. */
    const moveListTo = (wanted: number) => {
      const most = hiddenRows()
      const target = within(wanted, most)
      const past = pastStop()
      if (Math.abs(within(past, most) - target) >= 1) {
        scroller.scrollTop += target - past
      }
      // At once: a frame later the list would have been put back where the page still was.
      update()
    }

    // Find in page, screen readers and text selection scroll the list itself.
    const followList = () => {
      if (hiddenRows() !== hidden) {
        scheduleUpdate()
      } else if (Math.abs(list.scrollTop - position) >= 1) {
        moveListTo(list.scrollTop)
      }
    }

    // WCAG 2.2 SC 2.4.11. Pointer focus is left alone, so nothing moves from under the pointer.
    const showFocused = (event: Event) => {
      const target = event.target as Element
      if (target === list || !target.matches(':focus-visible')) {
        return
      }
      const box = target.getBoundingClientRect()
      const view = list.getBoundingClientRect()
      const top = list.querySelector('thead')?.getBoundingClientRect().bottom ?? view.top
      const bottom = view.top + list.clientHeight
      let wanted = list.scrollTop
      if (box.top < top) {
        wanted -= top - box.top
      } else if (box.bottom > bottom) {
        wanted += box.bottom - bottom
      }
      moveListTo(wanted)
    }

    // The reduced-motion rule in index.css gives every property a 0.01ms transition, so a height
    // set here would not be there to measure until the next frame.
    list.style.transitionProperty = 'none'
    spacer.style.transitionProperty = 'none'
    scheduleUpdate()
    scroller.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    list.addEventListener('scroll', followList, { passive: true })
    list.addEventListener('focusin', showFocused)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate)
    for (const element of [scroller, scroller.firstElementChild, list.firstElementChild]) {
      if (element) {
        observer?.observe(element)
      }
    }

    return () => {
      scroller.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      list.removeEventListener('scroll', followList)
      list.removeEventListener('focusin', showFocused)
      observer?.disconnect()
      cancelAnimationFrame(frame)
      list.style.maxHeight = ''
      spacer.style.height = ''
      list.style.transitionProperty = ''
      spacer.style.transitionProperty = ''
    }
  }, [track, list, spacer])

  return { trackRef, listRef, spacerRef }
}
