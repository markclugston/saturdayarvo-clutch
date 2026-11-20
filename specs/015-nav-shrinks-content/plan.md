# Implementation Plan: Navigation Expansion Resizes Content

**Branch**: `015-nav-shrinks-content` | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

## Summary

At viewport widths of 768 CSS px and above, the expanded side navigation widens its shell grid column (4rem to 10rem), so the main section shifts right and narrows instead of being overlaid. Below 768 the existing overlay behaviour (011) is kept. Expand/collapse triggers, Escape dismissal and the nav's width values are unchanged; only `AppShell` and `SideNav` layout change, driven by the existing `expanded` value in `App.tsx`.

## Technical Context

**Baseline**: Existing stack and settled decisions (see `docs/code-map.md`). Do not restate.

**Feature-specific changes**: None beyond baseline. Frontend-only; no packages, endpoints, schema or audit changes.

**Performance Goals**: Constitution defaults. Resize uses the existing 200 ms width transition (well under 500 ms); reduced motion disables it.

**Constraints**:
- Breakpoint is Tailwind's default `md` (768px), which matches FR-010 exactly (shrink at >= 768, overlay below).
- `expanded` state stays owned by `App.tsx` (hover, focus, Escape); `AppShell` receives it as a prop. No new state or effects.
- Content must keep focus and values across resize: the layout only changes classes on existing elements; no remount and no change to the DOM order or element tree.
- Hover stability (FR-006): the pointer is inside the nav while it expands, and content is not an expansion trigger, so collapse-on-leave cannot re-trigger expansion. Verified by e2e.

**Scale/Scope**: Two UI primitives (`app-shell.tsx`, `side-nav.tsx`), their tests, `navigation.spec.ts`, and the style-guide §3 wording.

## Constitution Check

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | UI stays in clutch-web; amends 011 only as the spec states; no extra features | Review | PASS |
| DOT-001 | No | No C# changes | N/A | N/A |
| DOT-002 | No | No data access | N/A | N/A |
| AUD-001 | No | No audit data | N/A | N/A |
| ENG-001 | Yes | Component tests (AppShell/SideNav) and Playwright geometry tests for each story; tests rewrite the 011 overlay assertions | Test tasks, quality gates | PENDING |
| OPS-001 | No | No service or migration change | N/A | N/A |
| SEC-001 | Yes (marginal) | No endpoints, auth, input or dependency change; independent review still runs over the diff at completion | Independent security review | PENDING |
| SEC-002 | No | No configuration or secrets | N/A | N/A |
| SEC-003 | No | No sensitive data | N/A | N/A |
| WEB-001 | Yes | Tokens and existing primitives only; see checklist below | Frontend gates, UI compliance checklist | PENDING |
| Perf & Observability | Yes | Resize visible within the 200 ms transition; no new user-initiated action or service metric | e2e timing/geometry assertions | PENDING |

**Style guide sections**: §2 Layout model (shell/canvas, no borders), §3 Navigation (the "overlay" wording is amended; see below), §8 Motion (200 ms ease-in-out, reduced motion), §9 Accessibility (focus visible within the shrunken section).

**Style guide change (WEB-001 synchronized update)**: `.claude/skills/clutch-ui-style/references/layout-navigation.md` §3 (and the Copilot copy under `.github/` via `.\scripts\sync-agent-config.ps1 -From claude`) must change: the 160 px width rationale "stay clear of the expanded overlay" becomes "overlays below 768px, shrinks content at 768px and above". No `index.css` or checklist-rule change.

**UI compliance checklist**:

- [ ] No borders or divider lines on layout containers (documented hairline exception only)
- [ ] Surface hierarchy follows canvas, content, card, raised
- [ ] Only tokens used: no raw hex, no default palette, no non-token radius
- [ ] Form fields use floating labels
- [ ] Navigation expand/collapse behaviour unchanged; only restyled (**deviation, justified**: this feature intentionally changes the overlay to a content resize at >= 768px per spec FR-001/FR-008; triggers, width and Escape behaviour are unchanged)
- [ ] Dark theme has no pure black surface or pure white text
- [ ] Both themes visually verified
- [ ] WCAG 2.2 AA contrast checked in both themes
- [ ] Visible focus ring on every interactive element
- [ ] Status not conveyed by colour alone
- [ ] `prefers-reduced-motion` respected

*Post-design re-check*: no new violations; the single justified deviation above is recorded in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/015-nav-shrinks-content/
├── plan.md
├── research.md
├── quickstart.md
└── tasks.md             # /speckit-tasks output
```

No data-model.md (no entities) and no contracts/ (no API or schema change; the layout contract is in research.md D1-D3).

### Source Code (files this feature touches)

```text
src/clutch-web/src/components/ui/app-shell.tsx        # navExpanded prop; md: grid column 4rem -> 10rem with width transition
src/clutch-web/src/components/ui/side-nav.tsx         # wrapper fills the column at md+; nav not overlaying at md+
src/clutch-web/src/components/ui/side-nav.test.tsx    # class/state tests
src/clutch-web/src/components/ui/app-shell.test.tsx   # new, sibling of side-nav.test.tsx
src/clutch-web/src/App.tsx                            # pass expanded to AppShell (lift existing value)
src/clutch-web/e2e/navigation.spec.ts                 # replace overlay geometry tests; add shrink, 767/768, stability
.claude/skills/clutch-ui-style/references/layout-navigation.md   # §3 wording (then sync to .github/)
```

**Structure Decision**: Existing layout, following sibling files. `App.tsx` currently computes `expanded` inside the nav component (line ~219) while `AppShell` is rendered above it (line ~114); the `expanded` computation must be lifted so both receive it. This is a state move, not new state.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Checklist item "Navigation expand/collapse behaviour unchanged" | The feature's purpose is to change overlay to resize at >= 768px (spec FR-001, FR-008) | Keeping the overlay contradicts the request |
| §8 Motion allow-list (colour, opacity, transform, width) and ESLint `clutch/style-tokens` | The shell animates `grid-template-columns` so the nav column and content move in step. Rule, `typography-motion-a11y.md` §8, `implementation.md` and `layout-navigation.md` §3 amended to allow `transition-[grid-template-columns]` (user-approved during implementation) | Instant content resize leaves a seam against the animating nav; a spacer element changes the DOM structure |
