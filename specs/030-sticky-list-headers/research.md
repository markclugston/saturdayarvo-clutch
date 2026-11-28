# Research: Sticky List Headers

R3 to R6 replace the first design (R1, R2: the header offset against the content panel), which the
spec revision of 2026-11-28 superseded.

## R3 How the group stops while its list scrolls, with one scrollbar

- **Finding**: The content panel is the only vertical scroller (`components/ui/content-panel.tsx`). Both tables sit in a focusable `role="region"` with `overflow-x-auto` inside a `Card`.
- **Decision**: The card is `position: sticky; top: 0` inside a wrapper, followed by a spacer. The panel's padding gives the margin above it. A shared hook, `usePinnedList`, limits the region's height to what the panel can show, makes the spacer as tall as the rows left out, and sets the region's `scrollTop` to the distance the panel has scrolled past the stopping point. The region is `overflow-y: hidden`, so wheel, touch and keys scroll the panel. The header is a CSS `sticky` row of that region.
- **Alternatives rejected**:
  - A region that scrolls vertically by itself: a second scrollbar, and a wheel over the list moves it before the group has stopped (FR-006).
  - Translating the header (R1): the group does not stop.
  - CSS scroll-driven animations: not supported by every browser in use.

## R4 Keeping the two scroll positions in step

- **Decision**: Anything else that moves the region (find in page, screen-reader or selection scrolling, the browser revealing a focused control) moves the panel to match, unless the list's own size changed. A control with visible focus that is cut off or under the header is brought into view the same way. Pointer focus is left alone, so nothing moves under the pointer. `overflow-anchor: none` stops scroll anchoring moving either scroller.

## R5 Painting over the header

- **Finding**: `App.tsx` raises focused buttons to `z-50`, above a `z-10` header.
- **Decision**: `isolate` on `tbody` keeps that inside the body. A higher header `z-index` would paint over the navigation overlay (`z-40`).

## R7 The amortization schedule

- **Finding**: `AmortizationSchedule.tsx` renders only the rows in view, measured against the content panel. Its card is the `section` in `LoanPayoffTimeline.tsx`, and it has no scrolling element of its own, so a wide schedule scrolls the whole panel sideways.
- **Decision**: `LoanPayoffTimeline` calls `usePinnedList` and makes its card sticky in the schedule view only. The schedule's rows get a scrolling element, a focusable named group (not a second landmark inside the card's region). The row window is measured from whichever of the panel's top and that element's top is lower, and remeasured on either one's scroll.
- **Found in implementation**: the 0.01ms transition that `index.css` sets under reduced motion resized the schedule's spacers a frame after its rows. The list's height jumped, the browser pulled its scroll position back, and the hook moved the panel to match. The spacers, and the elements the hook sizes, take no transition.
- **Consequence**: `overflow-y: hidden` forces `overflow-x` to scroll, so a wide schedule now scrolls sideways within its card (FR-007).

## R6 Load More at the end of the list

- **Decision**: Load More and its error move inside the region, after the table, and stay at the left while the table scrolls sideways. Left outside the region they would stay in view (FR-005). The region gets a few pixels of room, only when they are present, so their focus ring is not clipped.
- **Alternatives rejected**: leaving them below the region in a card taller than the panel: they would show in the margin under the stopped group.
