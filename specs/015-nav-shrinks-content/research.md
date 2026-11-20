# Research: Navigation Expansion Resizes Content

No NEEDS CLARIFICATION items remain; these are design decisions.

## D1: Resize mechanism

- **Decision**: `AppShell` takes `navExpanded` and switches its grid columns (`4rem` vs `10rem`) at `md:` and up, with `transition-[grid-template-columns] duration-200 ease-in-out`. Below `md` the columns stay `4rem` and the nav overlays as today.
- **Rationale**: Content is already column 2 (`minmax(0,1fr)`), so it shifts and narrows with no remount, which preserves focus and input values (FR-005). One animated property keeps nav and content in step (no seam).
- **Alternatives**: Animating content margin or padding (extra element, risk of seams); JS `matchMedia` to pick a mode (extra state and effect, forbidden by the frontend rules against derived-state effects); `position: sticky` or flex on the nav (breaks the DOM order guarantees).

## D2: Breakpoint

- **Decision**: Tailwind default `md` (768px). `md:` applies at 768 and wider, matching FR-010 with no custom token.
- **Alternatives**: Custom `@theme` breakpoint (unneeded).

## D3: Nav element geometry at md+

- **Decision**: At `md:` the nav wrapper fills its column (`md:w-full`) and the nav is `md:w-full`; below `md` the wrapper stays `w-16` and the nav keeps absolute positioning with `w-40` when expanded. The 160 px width is unchanged.
- **Rationale**: Column width and nav width stay equal, so no overlap occurs at md+.
- **Edge**: `overflow-hidden` on the nav plus `hidden` labels (existing) avoid label wrap during the transition.

## D4: Hover stability (FR-006)

- **Decision**: No extra hysteresis. Expansion triggers only on the nav element (hover or focus within), and it grows under the pointer, so the pointer stays inside. On collapse the pointer is already outside. Content moving under a stationary pointer does not trigger the nav.
- **Verify**: e2e repeats hover on the edge pixel (x = 63 to 65) and asserts the state settles.

## D5: Reduced motion

- **Decision**: `index.css` (~line 147) already has a global `prefers-reduced-motion` rule forcing `transition-duration: 0.01ms !important`. Rely on it, and keep `motion-reduce:transition-none` on the new grid transition as explicit intent. Tests therefore assert a computed duration of at most 0.01ms (not exactly `0s`).

## D6: Superseded 011 tests

- **Decision**: The e2e tests asserting overlay geometry at 1280 and 1920 (`navigation.spec.ts` "overlays only intersecting page content...", lines ~476-520, and the "usable across viewports" checks at ~132-175 and ~251-300) are rewritten: shrink at >= 768, overlay at 320 and 767.
