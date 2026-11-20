---

description: "Task list for Navigation Expansion Resizes Content"
---

# Tasks: Navigation Expansion Resizes Content

**Input**: `specs/015-nav-shrinks-content/` (plan.md, spec.md, research.md, quickstart.md; no data-model or contracts)

**Tests**: REQUIRED (ENG-001). Write tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- Paths are relative to the repo root. Web code lives in `src/clutch-web/`.
- Frontend-only feature: no C#, data, audit or migration tasks.

## Phase 1: Setup

- [X] T001 Read `src/clutch-web/package.json` scripts and `src/clutch-web/src/index.css` to confirm test/lint script names and whether a global reduced-motion rule already disables transitions (research D5). Finding: `index.css` (~line 147) has a global `prefers-reduced-motion` rule setting `transition-duration: 0.01ms !important`; record the chosen mechanism (global rule, with `motion-reduce:transition-none` kept as explicit intent) in `research.md` D5.

## Phase 2: Foundational (blocks all stories)

- [X] T002 Lift `expanded` state out of `PrimaryNavigation` into `src/clutch-web/src/App.tsx`: move hover/keyboardFocused/dismissed/pointerFocus state, the `expanded` value and the Escape effect into the signed-in component (or a small hook in the same file) so both `AppShell` (new `navExpanded` prop) and `SideNav`/`SideNavItem` receive it. Behaviour must be identical to today (FR-004); no new state or effects.

**Checkpoint**: build + existing fast tests pass (`npx vitest related src/App.tsx --run --reporter=dot`).

---

## Phase 3: User Story 1 - Expanding navigation makes room instead of covering content (Priority: P1) 🎯 MVP

**Goal**: At >= 768px the expanded nav widens its grid column so the main section shifts right and narrows by 96px. | **Independent Test**: Hover the nav at 1280px and compare main left edge and width before, during and after.

- [X] T003 [P] [US1] Create `src/clutch-web/src/components/ui/app-shell.test.tsx` (sibling of `side-nav.test.tsx`): `navExpanded` false gives `md:grid-cols-[4rem_minmax(0,1fr)]`, true gives `md:grid-cols-[10rem_minmax(0,1fr)]`; base (below md) stays `grid-cols-[4rem_minmax(0,1fr)]`; header, nav, children DOM order unchanged (FR-001, FR-002).
- [X] T004 [P] [US1] Extend `src/clutch-web/src/components/ui/side-nav.test.tsx`: wrapper has `w-16` below md and `md:w-full` at md+; nav keeps `absolute` with `w-16`/`w-40` below md and `md:w-full` at md+; labels hidden when collapsed (FR-001, FR-004).
- [X] T005 [P] [US1] Rewrite the 011 overlay-geometry test in `src/clutch-web/e2e/navigation.spec.ts` (~line 476, "overlays only intersecting page content...") as "shrinks main section on expand at 1280 and 1920": main left edge +96px, main width -96px, nav covers no content; collapse restores both (SC-001, SC-002, FR-001, FR-002).
- [X] T006 [P] [US1] Add keyboard-focus case in `src/clutch-web/e2e/navigation.spec.ts`: focusing a destination expands the nav and shrinks main exactly as hover; content with long lists or tables reflows with nothing clipped and the page has no horizontal scroll, run in Light, Dark and System themes (US1 scenarios 3-4, FR-003, SC-003).
- [X] T007 [US1] Update `src/clutch-web/src/components/ui/app-shell.tsx`: add `navExpanded: boolean` prop; grid classes `grid-cols-[4rem_minmax(0,1fr)]` plus `md:` variant switching `md:grid-cols-[4rem_minmax(0,1fr)]`/`md:grid-cols-[10rem_minmax(0,1fr)]` with `transition-[grid-template-columns] duration-200 ease-in-out motion-reduce:transition-none` (research D1, D5).
- [X] T008 [US1] Update `src/clutch-web/src/components/ui/side-nav.tsx`: wrapper gets `md:w-full`; nav gets `md:w-full` and keeps `absolute` with its own `w-16`/`w-40` below md, so at md+ it fills the column exactly (research D3), keeping `overflow-hidden` and the 200 ms width transition; widths 64/160px unchanged (research D3).
- [X] T009 [US1] Pass `navExpanded={expanded}` to `<AppShell>` in `src/clutch-web/src/App.tsx` and update the stale "while the pointer holds the overlay open" comment (~line 157) to reflect overlay-below-md only.

**Checkpoint**: T003-T006 pass; run `npx vitest related src/components/ui/app-shell.tsx src/components/ui/side-nav.tsx src/App.tsx --run --reporter=dot` and `npx playwright test e2e/navigation.spec.ts --reporter=line`.

---

## Phase 4: User Story 2 - Resizing stays stable and comfortable (Priority: P2)

**Goal**: No flicker, lost focus or lost input; reduced motion respected. | **Independent Test**: Repeated hover on the nav edge and typing during expand/collapse.

- [X] T010 [P] [US2] Add e2e in `src/clutch-web/e2e/navigation.spec.ts`: type in a page field, expand then collapse the nav, assert the field keeps focus and value (FR-005, SC-004).
- [X] T011 [P] [US2] Add e2e in `src/clutch-web/e2e/navigation.spec.ts`: repeatedly hover edge pixels x=63..65 and assert nav state settles: sample `aria-expanded`/width every 50 ms for 1 s after the last move and allow at most one state change (FR-006, SC-005, research D4).
- [X] T012 [P] [US2] Add e2e in `src/clutch-web/e2e/navigation.spec.ts` with `reducedMotion: 'reduce'` emulation: final geometry applied immediately, computed transition-duration of the shell grid is at most 0.01ms (global reduced-motion rule; `0s` if `motion-reduce:transition-none` wins) (FR-007).
- [X] T013 [P] [US2] Add e2e in `src/clutch-web/e2e/navigation.spec.ts`: expanded nav stays expanded across a destination change with no layout jump; no seam or gap between nav and content in Light, Dark and System (edge cases).
- [X] T014 [US2] Fix any failures found by T010-T013 in `src/clutch-web/src/components/ui/app-shell.tsx` or `side-nav.tsx` (no hysteresis unless T011 proves it needed; if so record it in `research.md` D4).

**Checkpoint**: US2 e2e pass in all three theme modes.

---

## Phase 5: User Story 3 - Works on narrow screens (Priority: P2)

**Goal**: Below 768px the nav still overlays and main is untouched. | **Independent Test**: At 320 and 767px expand the nav; main geometry unchanged, no page horizontal scroll.

- [X] T015 [P] [US3] Add e2e in `src/clutch-web/e2e/navigation.spec.ts` at 320 and 767: expand overlays main, main left edge and width unchanged, `document.documentElement.scrollWidth <= clientWidth`; collapse removes overlay; run in Light, Dark and System themes (FR-009, FR-003, SC-003, US3 scenarios 1-2).
- [X] T016 [P] [US3] Add e2e boundary test in `src/clutch-web/e2e/navigation.spec.ts`: 767 overlays, 768 shrinks (FR-010, US3 scenario 3).
- [X] T017 [US3] Rewrite the "usable across viewports" (~lines 132-175) and "deeply nested category actions" (~lines 251-300) assertions in `src/clutch-web/e2e/navigation.spec.ts` so overlay expectations apply only below 768 and shrink expectations at >= 768 (research D6).
- [X] T018 [US3] Fix any narrow-screen regressions found by T015-T017 in `src/clutch-web/src/components/ui/side-nav.tsx` or `app-shell.tsx`.

**Checkpoint**: all navigation e2e pass at 320, 767, 768, 1280, 1920.

---

## Phase 6: Completion Gates

- [X] T019 Update `.claude/skills/clutch-ui-style/references/layout-navigation.md` §3: 160px rationale becomes "overlays below 768px, shrinks content at 768px and above"; also amend `layout-navigation.md` line 30 and `references/compliance-checklist.md` line 9 ("Navigation expand/collapse behaviour unchanged; only restyled") to "...unless an approved spec amends it (015: content resizes at 768px and above)"; then run `.\scripts\sync-agent-config.ps1 -From claude` (WEB-001, CLAUDE.md). Update the plan.md checklist item to match and drop the Complexity Tracking row if the rule no longer conflicts.
- [X] T020 Validate the UI compliance checklist in `plan.md` in both themes, with the recorded deviation, and WCAG 2.2 AA contrast and focus visibility in the shrunken section (WEB-001, `clutch-ui-style`).
- [X] T021 Independent security review of the full diff (SEC-001..003, `clutch-security-review`).
- [X] T022 Run completion quality gates from `src/clutch-web` and record results: `npm run lint`, `npm run test`, `npm run build`, `npm audit --omit=dev`, plus `npx playwright test e2e/navigation.spec.ts` (ENG-001, `clutch-frontend`).
- [X] T023 Run `/speckit-converge` and resolve any remaining unbuilt work before declaring the feature complete (constitution Workflow and Delivery Gates).

---

## Dependencies & Execution Order

- Setup → Foundational → US1 → US2 and US3 → Completion Gates.
- T007, T008, T009 need T002 and make T003-T006 pass; T009 needs T007.
- US2 and US3 build on the US1 layout; they can run in parallel with each other. T015-T017 and T010-T013 edit the same spec file, so avoid simultaneous edits.
- T019 is independent of code and may run any time after T008.

## Parallel Opportunities

- US1: T003, T004, T005, T006 (tests, different files except T005/T006 share `navigation.spec.ts`).
- US2: T010, T011, T012, T013.
- US3: T015, T016.

## Implementation Strategy

MVP = User Story 1 (T001-T009). Deliver US2 and US3 afterward; each must pass its own tests before the next starts.
