# UI Contract: Pinned List Group

Behaviour is in [spec.md](../spec.md) (FR-001..FR-007); the mechanism is in [research.md](../research.md) (R3..R6).

## Hook

`src/clutch-web/src/lib/usePinnedList.ts`

```ts
function usePinnedList(): {
  trackRef: React.RefCallback<HTMLDivElement>  // wrapper: the card first, the spacer after it
  listRef: React.RefCallback<HTMLDivElement>   // the table's region
  spacerRef: React.RefCallback<HTMLDivElement>
}
```

- Scroller: nearest ancestor of the wrapper with computed `overflow-y` `auto` or `scroll` (the content panel). None found: no styles, no listeners.
- List height: `space = clientHeight − paddingTop − paddingBottom − (card height − list height)`. If `space >= 192` the list's `max-height` is `space` px, otherwise none.
- `hidden = list.scrollHeight − list.clientHeight`; the spacer is that tall.
- Position: `past = scrollerTop + paddingTop − trackTop`; `list.scrollTop = clamp(past, 0, hidden)`.
- No transition on the list or spacer (`transition-property: none` while active): under reduced motion `index.css` would otherwise apply their heights a frame late.
- Recomputed on scroller `scroll` (passive), window `resize` and size changes (`ResizeObserver`) of the scroller, its content and the list's content, at most once per animation frame.
- List `scroll` that the hook did not cause, with `hidden` unchanged: the scroller moves by `list.scrollTop − past`.
- `focusin` in the list, target other than the list and matching `:focus-visible`: if it starts above the header's bottom or ends below the list's visible bottom, scroll the list position to show it, moving the scroller the same way, at once.
- Unmount removes listeners, observer, pending frame and inline styles.

## Markup (amortization schedule, research.md R7)

| Element | Change |
|---|---|
| wrapper `div` (`LoanPayoffTimeline`) | new; `ref={trackRef}`, `flex min-w-0 flex-1 flex-col [overflow-anchor:none]` |
| card `section` | `sticky top-0` in the schedule view only; otherwise unchanged |
| spacer `div` | new, after the card; `ref={spacerRef}`, `aria-hidden`, `shrink-0` |
| rows wrapper (`AmortizationSchedule`) | becomes the list: `ref` from the `listRef` prop, `role="group"`, `aria-label="Schedule Rows"`, `tabIndex={0}`, `min-w-0 overflow-x-auto overflow-y-hidden [overflow-anchor:none] focus-visible:rounded-control focus-visible:focus-ring`; no longer `flex-1` |
| `role="table"`, header row (already `sticky top-0`), rows | unchanged |
| The two spacer `div`s standing in for unrendered rows | add `transition-none` (research.md R7) |
| Row window | offset = `max(panel top, list top) − table top`, measured on panel and list `scroll` and window `resize` |

## Markup (transactions and assets)

| Element | Change |
|---|---|
| wrapper `div` | new; `ref={trackRef}`, `min-w-0 [overflow-anchor:none]` |
| `Card` | `sticky top-0`; otherwise unchanged |
| spacer `div` | new, after the card; `ref={spacerRef}`, `aria-hidden` |
| region `div` | `ref={listRef}`; adds `overflow-y-hidden [overflow-anchor:none]`; name, role, tab stop and `overflow-x-auto` unchanged |
| `thead` | `sticky top-0 z-10`; keeps `bg-raised` |
| `tbody` | `isolate` |
| `tfoot` (assets), caption, `th scope`, labels, alignment | unchanged |
| Load More and its error (transactions) | inside the region, after the table, `sticky left-0 w-fit`; table and these share a `w-fit min-w-full` wrapper; region adds `-mx-1 -mb-1 px-1` and the wrapper `pb-1` only when they are shown |
| Empty, loading and error states | unchanged |
