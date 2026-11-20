---

description: "Tasks for 014 Style Guide Compliance"
---

# Tasks: Style Guide Compliance

**Input**: `specs/014-style-guide-compliance/` (plan.md, spec.md, research.md, quickstart.md, contracts/)

**Tests**: REQUIRED (ENG-001). Write tests first and confirm they fail before implementing. Existing
component and journey tests MUST NOT have behavioural assertions changed (FR-014, SC-004). The only
existing expectations that change are the two `e2e/navigation.spec.ts` layout expectations in T020a.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- All paths are relative to `src/clutch-web/` unless they start with `.claude/`, `.github/` or `specs/`.
- Run every command from `src/clutch-web`.
- Test cadence (clutch-frontend): after each task run `npx vitest related <changed files> --run --reporter=dot`; at the end of each phase run typecheck, lint and unit tests once.

---

## Phase 1: Setup

- [ ] T001 Create `playwright.style-guide.config.ts` per research R7: `testMatch` `style-guide.spec.ts`, projects `desktop-1024` (1024×768) and `desktop-1440` (1440×900), `reducedMotion: 'reduce'`, dev-server webServer only (no test API), same port handling as `playwright.config.ts`
- [ ] T001a Add `testIgnore: ['style-guide.spec.ts']` to `playwright.config.ts` so `npx playwright test` does not run the style-guide spec (R7)
- [ ] T002 Create `e2e/style-guide.spec.ts` harness per contracts/visual-states.md:
  - `page.route` API mocks (session, preferences theme Light/Dark, accounts with a long name, transactions for a wide table, import settings and review with a warning row, categories with a long name, import limits) and a helper that mocks a form's submit endpoint with a 400 ProblemDetails response;
  - a per-state helper running, in order: the surface checks (nav = `canvas`, `main` = `content` with 22px radius, `[data-slot="card"]` = `card` with 16px radius, zero border width on `nav`, `main`, `header` and cards, current nav item ≥3:1 against `canvas`), AxeBuilder (`wcag2a`,`wcag2aa`,`wcag21aa`,`wcag22aa`) zero violations, `scrollWidth <= clientWidth`, and a focus sweep (Tab through every focusable element and assert computed `outline-style` is not `none` and `outline-width` ≥ 2px, FR-007, D5);
  - `toHaveScreenshot('<state>-<theme>.png')` only when `STYLE_SCREENSHOTS=1`, so no baseline is written before T055;
  - test names `<state> [Light]` / `<state> [Dark]`; for the pre-auth states (1–5, 22, 23) in `[Dark]`, add the `dark` class to `<html>` before the checks
- [ ] T003 [P] Delete the empty, untracked folders `e2e/import-mapping-layout.spec.ts-snapshots/` and `e2e/ui-compliance/` and the stray `e2e/test-results/` (research R7). Nothing is committed for this

## Phase 2: Foundational (blocks all stories)

- [ ] T005a [P] Token contrast test in `src/tokens.contrast.test.ts`: parse the `:root` and `.dark` channels from `src/index.css` and assert every pair listed under "Contrast pairs checked by T005a" in contracts/design-tokens.md, in both themes (FR-010, WCAG 1.4.3 and 1.4.11). Write it before T004 and confirm it fails on the current shadcn values
- [ ] T004 Replace the shadcn variables in `src/index.css` with the token set per contracts/design-tokens.md: `:root` Light and `.dark` Soft Dark RGB channels, `@theme inline` colour/radius/`shadow-float` mappings (R1, R2); remove `* { @apply border-border outline-ring/50 }`; change the `body` rule to `bg-canvas text-fg text-sm` (R3); keep `button { cursor-pointer }` and `html { font-sans }`. T005a passes
- [ ] T005 Add `@utility focus-ring` (`outline: 2px solid rgb(var(--primary)); outline-offset: 2px`, D5), `@utility hairline-t`, `@utility hairline-b` and the global `@media (prefers-reduced-motion: reduce)` 0.01ms duration rule to `src/index.css` per R5 and R9
- [ ] T005b [P] Unit test `src/lib/utils.test.ts` for `cn`: `cn('text-sm', 'text-fg')` keeps both, `cn('rounded-control', 'rounded-card')` keeps only `rounded-card`, `cn('bg-card', 'bg-raised')` keeps only `bg-raised`, `cn('focus-visible:focus-ring', 'p-3')` keeps both. If a case fails, configure the `cn` package's merge groups in `src/lib/utils.ts` (no new dependency) until it passes
- [ ] T006 [P] Component tests for `FloatingField` in `src/components/ui/floating-field.test.tsx`: label floats on focus and on value, accessible name is the label, `aria-describedby` merges `describedBy`, description and error ids, `aria-invalid` only with `error`, error text plus `aria-hidden` icon rendered, `as="select"` works; confirm they fail
- [ ] T006a [P] Component tests for `ErrorMessage` in `src/components/ui/error-message.test.tsx`: renders its text with `role="alert"` by default, accepts another `role` and an `id`, icon is `aria-hidden`; confirm they fail
- [ ] T007 [P] Component tests for `StatusChip` in `src/components/ui/status-chip.test.tsx`: renders required text for each `status`, optional icon is `aria-hidden`, `role` and `id` pass through; confirm they fail
- [ ] T008 [P] Create `Card` (with `data-slot="card"`), `CardTitle` (`as` `h2`/`h3`, `text-base font-semibold`) and `CardFooter` in `src/components/ui/card.tsx` per contracts/ui-primitives.md
- [ ] T009 [P] Create `ContentPanel` in `src/components/ui/content-panel.tsx`: a `main` with `bg-content rounded-panel`, gutter `m-2 lg:m-3`, padding `p-4 xl:p-6`, inner `mx-auto max-w-5xl` (R10); passes `main` props such as `inert` through
- [ ] T010 [P] Create `AppShell` in `src/components/ui/app-shell.tsx` (`min-h-svh flex bg-canvas`; `nav` slot, then a column with the `header` slot and the content slot; the nav is never inside the header)
- [ ] T011 [P] Create `FloatingField` in `src/components/ui/floating-field.tsx` per §4 and contracts/ui-primitives.md: control `peer h-14 bg-transparent focus-visible:focus-ring` inside `bg-raised rounded-control`; rest label `text-fg-secondary` (D2) floated with `translate`/`scale` and `transition-[color,transform] duration-150 ease-out`; T006 passes
- [ ] T011a [P] Create `ErrorMessage` in `src/components/ui/error-message.tsx` (`text-danger`, `aria-hidden` `CircleAlert` icon, `role="alert"` default, `p` props passed through); T006a passes
- [ ] T012a [P] Component tests for `Chip` in `src/components/ui/chip.test.tsx`: no remove button without `onRemove`; with `onRemove`, a button named `Remove <label>` calls it once; confirm they fail
- [ ] T012 [P] Create `Chip` in `src/components/ui/chip.tsx` (`bg-raised rounded-chip`, remove button when `onRemove`); T012a passes
- [ ] T013 [P] Create `StatusChip` in `src/components/ui/status-chip.tsx` (`bg-{status}-bg text-{status} rounded-chip`, `span` props passed through); T007 passes
- [ ] T014 [P] Create `Tooltip` in `src/components/ui/tooltip.tsx` with `@base-ui/react/tooltip`; popup `bg-neutral-strong text-neutral-strong-contrast rounded-chip shadow-float`
- [ ] T015a [P] Component tests for `Button` in `src/components/ui/button.test.tsx`: each variant renders a `button` with no `border*` class and with `focus-visible:focus-ring`, and `disabled`, `type`, `aria-label` and `ref` pass through; confirm they fail before T015
- [ ] T015 Rewrite `Button` variants in `src/components/ui/button.tsx` per contracts/ui-primitives.md: `primary|secondary|tertiary|danger|icon`, sizes `default|sm|icon`, `cursor-pointer rounded-control transition-colors focus-visible:focus-ring`, min height 40px, no border; `secondary` is `bg-secondary-solid text-secondary-solid-contrast` and `danger` is `bg-danger-solid text-danger-solid-contrast` (one class set for both themes; no `dark:` variant). Old variant names (`default`, `destructive`, `outline`, `ghost`, `link`) are removed; callers move in T047; T015a passes
- [ ] T016 [P] Restyle `src/components/ui/dialog.tsx`: popup `bg-card rounded-card shadow-float`, no border, `transition-[opacity,transform] duration-200 ease-out` with Base UI's starting and ending style attributes; backdrop `bg-scrim/40` with `transition-opacity duration-200 ease-out`; exports unchanged
- [ ] T017 [P] Add title style `text-2xl font-semibold` in `src/components/ui/page-heading.tsx` (§7)
- [ ] T018a [P] Component tests for `SideNav`/`SideNavItem` in `src/components/ui/side-nav.test.tsx`: with `expanded={false}`, a focused or hovered item shows a tooltip with its label (in the app this is the post-Escape state); when expanded, the label is visible and there is no tooltip; the current item has `aria-current="page"`; every item has the `cursor-pointer` class and its `aria-label`; confirm they fail
- [ ] T018 Create `SideNav` and `SideNavItem` in `src/components/ui/side-nav.tsx` per contracts/ui-primitives.md: `w-16` placeholder, overlay `nav.bg-canvas` `w-16`/`w-60` with `transition-[width] duration-200 ease-in-out`, item `cursor-pointer rounded-control hover:bg-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-contrast font-semibold transition-colors focus-visible:focus-ring` (D6), icon `size-5`, labels `transition-opacity duration-200` keeping the `hidden` toggle, Tooltip when collapsed (R9; needs T014); T018a passes
- [ ] T047 Replace every hand-built `<button className=…>` with `Button` (`primary|secondary|tertiary|danger|icon`); there are no existing `Button` callers. Files: `src/App.tsx` (header Import limits and Sign out, session error Try again, Retry session check), `src/features/accounts/AccountsPage.tsx`, `src/features/accounts/AccountDetails.tsx`, `src/features/accounts/TransactionsTable.tsx`, `src/features/accounts/DeleteTransactionDialog.tsx`, `src/features/categories/DeleteCategoryDialog.tsx`, `src/features/admin/ImportLimitsPage.tsx`, `src/features/auth/AuthPage.tsx`, `src/features/categories/CategoriesPage.tsx`, `src/features/imports/ImportEndedDialog.tsx`, `src/features/imports/ImportMappingForm.tsx` and `src/features/imports/ImportPage.tsx`; button text, `type`, `disabled`, `ref`, `aria-*` and accessible names unchanged. The nav buttons in `src/App.tsx` are left to T020 (`SideNavItem`). Needs T015

**Checkpoint**: `npm run typecheck`, `npm run lint` (existing rules) and `npm test -- --reporter=dot` pass (T005a, T005b, T006, T006a, T007, T012a, T015a, T018a green).

---

## Phase 3: User Story 1 - Consistent, calm look across every screen (Priority: P1) 🎯 MVP

**Goal**: Every signed-in screen and the session error screen use canvas → content panel → card → raised with tokens only and no layout borders. | **Independent Test**: Light-theme states 6, 9, 12, 14, 16, 19 and 23 in visual-states.md pass the surface, axe, focus and no-horizontal-scroll checks.

- [ ] T019 [US1] Add Light+Dark states `accounts`, `account-details`, `import-mapping`, `import-review`, `categories`, `import-limits` (long names, wide tables) and `session-error` to `e2e/style-guide.spec.ts`; confirm their surface checks fail before T020–T026
- [ ] T020 [US1] Use `AppShell` (header, nav and content slots), `SideNav`/`SideNavItem` and `ContentPanel` in `src/App.tsx`:
  - expand/collapse/Escape triggers, accessible names and overlay behaviour unchanged (FR-011); the nav stays outside the `header` (banner);
  - keep the `relative z-20` lift for focused controls inside `main` (`[&_:is(button,input,select,textarea):not(.sr-only):focus-visible]:relative …:z-20`), which keeps focus visible over the overlay; remove the arbitrary `outline-*` focus rules (the `focus-ring` utility replaces them);
  - header on `canvas` with no border, holding the app name, `ThemeSelector`, Import limits and Sign out;
  - the session load error screen and the "Unable to refresh your session" and sign-out messages use `ErrorMessage` (same text and role) inside a `Card`
- [ ] T020a [US1] Update the two expectations SC-004 allows in `e2e/navigation.spec.ts`: line 576 `toHaveCSS('width', '56px')` becomes `'64px'`; in "overlays only intersecting page content without changing its geometry", remove the non-320px assertion `expect(pane.x + pane.width).toBeLessThanOrEqual(expandedHeading.x)` (the same test already asserts that `main` and the heading keep their geometry when the nav expands, which is the overlay behaviour FR-011 requires); keep the centring assertion. No other line changes
- [ ] T021 [US1] Run `npx vitest related src/App.tsx --run --reporter=dot`; `src/App.test.tsx` passes unchanged, including its `cursor-pointer` assertions on the nav buttons
- [ ] T022 [P] [US1] Rebuild sections as `Card`s with `CardTitle` (same heading levels), tokens only, no borders/dividers, in `src/features/accounts/AccountsPage.tsx`; long account names wrap inside the card; loading and error messages use `text-fg-secondary` / `ErrorMessage` with unchanged text and roles
- [ ] T023 [P] [US1] Rebuild `src/features/accounts/AccountDetails.tsx` and `src/features/accounts/TransactionsTable.tsx` in `Card`s; table in `overflow-x-auto`, row separators only `hairline-b`; messages as in T022
- [ ] T024 [P] [US1] Rebuild `src/features/imports/ImportPage.tsx` (file selection, mapping and review steps) and `src/features/imports/ImportReviewTable.tsx` in `Card`s; table in `overflow-x-auto`, `hairline-b` row separators only, `text-right` on amount and balance kept; every `role="alert"` message uses `ErrorMessage` and every `role="status"` message uses `text-fg-secondary`, with unchanged text and roles
- [ ] T025 [P] [US1] Rebuild `src/features/categories/CategoriesPage.tsx` tree in a `Card`; no borders, `hover:bg-hover`, long names wrap or scroll inside the card; keep `text-xl` on groups, `mt-6` on group items and the depth padding; the focusable "Groups and categories" list uses `focus-visible:focus-ring`
- [ ] T026 [P] [US1] Rebuild `src/features/admin/ImportLimitsPage.tsx` in `Card`s with tokens only; messages as in T022
- [ ] T027 [US1] Run `npm test -- --reporter=dot` and `npx playwright test --config playwright.style-guide.config.ts --grep "\[Light\]"` for the US1 states; fix screens until green (no existing behavioural assertion changed)

**Checkpoint**: US1 states pass in Light; existing component tests pass.

---

## Phase 4: User Story 2 - Forms use floating labels (Priority: P1)

**Goal**: Every text input and select uses `FloatingField`; form error messages are danger text with an icon (FR-006, FR-007, R11). | **Independent Test**: States 1–4, 7, 10, 13, 17, 20 and 22 pass; existing form component tests pass unchanged.

- [ ] T028 [US2] Add states `sign-in`, `sign-in-errors`, `sign-in-field-focused`, `sign-in-field-filled`, `sign-up`, `accounts-create-errors`, `account-details-errors`, `import-mapping-errors`, `categories-errors`, `import-limits-errors` to `e2e/style-guide.spec.ts` (errors states submit against the 400 mock from T002); confirm their surface or focus checks fail first
- [ ] T029 [P] [US2] In `src/features/auth/AuthPage.tsx`: render the page as `ContentPanel` (still the `main` element that receives `inert`) with the form in a `Card`; email and password become `FloatingField`s with unchanged `id`, `name`, `type`, `autoComplete` and `required`; in sign-up mode pass `describedBy="password-requirements"`; the form error uses `ErrorMessage`
- [ ] T030 [P] [US2] Convert create-account fields (description input, currency select) to `FloatingField` in `src/features/accounts/AccountsPage.tsx`; form error uses `ErrorMessage`
- [ ] T031 [P] [US2] Convert edit form fields to `FloatingField` in `src/features/accounts/AccountDetails.tsx`; form error uses `ErrorMessage`
- [ ] T032 [P] [US2] Convert mapping selects and inputs to `FloatingField` (`as="select"` for selects; existing helper text passed as `description`) in `src/features/imports/ImportMappingForm.tsx`; form error uses `ErrorMessage`
- [ ] T033 [P] [US2] Convert create-category fields (name input, parent select) to `FloatingField` in `src/features/categories/CategoriesPage.tsx`; inline rename keeps its `sr-only` label but uses `bg-raised rounded-control focus-visible:focus-ring` (D3, R8); form error uses `ErrorMessage`
- [ ] T034 [P] [US2] Convert limit fields to `FloatingField` in `src/features/admin/ImportLimitsPage.tsx`; form error uses `ErrorMessage`
- [ ] T034a [US2] In `src/features/imports/ImportPage.tsx`, keep the duplicate-confirmation checkbox label and the hidden `#csv-file` input as D3 exceptions: the checkbox gets `accent-primary focus-visible:focus-ring`, the "CSV file" label text and description use tokens only, and accessible names and descriptions are unchanged. Needs T024
- [ ] T035 [US2] Run `npm test -- --reporter=dot` (AuthPage, AccountsPage, AccountDetails, ImportPage, CategoriesPage, ImportLimitsPage tests unchanged) and the US2 style-guide states; fix until green

**Checkpoint**: All forms float labels; error states pass axe in both themes.

---

## Phase 5: User Story 3 - Soft Dark theme is comfortable and complete (Priority: P2)

**Goal**: Every screen and dialog renders in Soft Dark with no pure black surface or pure white text and AA contrast (FR-009, FR-010). | **Independent Test**: All style-guide states pass in the Dark theme, including theme switch with a dialog open.

- [ ] T036 [US3] Add state `theme-selector-error` and the theme-switch-while-dialog-open assertion to `e2e/style-guide.spec.ts`: open DeleteTransactionDialog, toggle the `dark` class on `<html>`, and assert the popup's computed `background-color` changes
- [ ] T037 [US3] Add to `e2e/style-guide.spec.ts` the Dark assertion over every state that no element's computed background is `rgb(0, 0, 0)` and no text colour is `rgb(255, 255, 255)` (FR-009), and the surface lightness assertions for both themes from contracts/visual-states.md
- [ ] T038 [US3] Convert the theme select to `FloatingField as="select"` (label "Theme", id `theme-mode` unchanged) and both the load-failure and save-failure messages to `ErrorMessage` with unchanged text in `src/components/theme/ThemeSelector.tsx`; `ThemeSelector.test.tsx` unchanged and passing
- [ ] T039 [US3] Remove any remaining colour `dark:` variants and fix any Dark contrast failure at token level in `src/index.css` (not per component); record any value change in contracts/design-tokens.md for T052
- [ ] T040 [US3] Run all style-guide states in Dark at both viewports; fix until green

**Checkpoint**: Both themes pass axe on every state so far.

---

## Phase 6: User Story 4 - Dialogs, buttons, status and navigation follow the guide (Priority: P2)

**Goal**: Dialogs use float surfaces, the inline delete panel uses the raised tone, buttons/chips use token radii, status uses `StatusChip` or text with an icon, nav is restyled with unchanged behaviour (FR-008, FR-011, FR-012). | **Independent Test**: States 5, 8, 11, 15, 18 and motion assertions pass; `navigation.spec.ts` passes with only the T020a changes.

- [ ] T041 [US4] Add states `startup-loading`, `nav-expanded`, `delete-transaction-dialog`, `import-ended-dialog`, `delete-category-panel` and the nav `transition-duration` assertions (<50ms with reduced motion; 150–250ms in a `reducedMotion: 'no-preference'` context), the same two duration assertions on the `DeleteTransactionDialog` popup, and the `nav-dismissed-tooltip` assertion (Tab into the nav, press Escape; the focused item's tooltip with its label is visible and passes axe) to `e2e/style-guide.spec.ts`
- [ ] T042 [P] [US4] Restyle `src/features/auth/StartupLoadingDialog.tsx` in place (R13): backdrop `bg-scrim/40` keeping `data-slot="startup-backdrop"` and `backdrop-blur-[2px]`, panel `bg-card rounded-card shadow-float` keeping `role="status"`, text `text-fg` / `text-fg-secondary`; markup structure, focus and Escape behaviour unchanged; not moved onto `Dialog`
- [ ] T043 [P] [US4] Restyle `src/features/accounts/DeleteTransactionDialog.tsx`: `Button variant="danger"` with its existing explicit delete text; errors via `ErrorMessage`
- [ ] T044 [P] [US4] Restyle `src/features/imports/ImportEndedDialog.tsx` on the restyled `Dialog`: title and description text unchanged (the outcome is stated in text), error via `ErrorMessage`, acknowledge as `Button variant="primary"`; no new content
- [ ] T045 [P] [US4] Restyle `src/features/categories/DeleteCategoryDialog.tsx` as the inline raised panel (R12): `bg-raised rounded-card p-4`, no border, no shadow; the existing "This will permanently delete…" sentence keeps its text with an `aria-hidden` warning icon in `text-warning`; `Button variant="danger"` with the existing "Delete" text; status and error messages via `text-fg-secondary` / `ErrorMessage`; `role="alertdialog"`, focus and Escape behaviour unchanged
- [ ] T046 [P] [US4] In the Warning column of `src/features/imports/ImportReviewTable.tsx`, show the existing "Possible duplicate" text as `StatusChip status="warning"` (the `—` placeholder stays plain text) (FR-008); `ImportReviewTable.test.tsx` unchanged
- [ ] T048 [US4] Run `npm test -- --reporter=dot`, `npx playwright test e2e/navigation.spec.ts e2e/startup.spec.ts --reporter=line` (both mock the API) and the US4 style-guide states; fix until green

**Checkpoint**: All 23 states pass in both themes and viewports.

---

## Phase 7: User Story 5 - Deviations are caught automatically (Priority: P3)

**Goal**: `npm run lint` fails on every forbidden pattern in the class strings of every `src/**/*.{ts,tsx}` file (FR-013). | **Independent Test**: Quickstart rows 1–3.

- [ ] T049 [US5] RuleTester tests in `eslint-rules/clutch-style.test.js`: assign `RuleTester.describe`, `RuleTester.it` and `RuleTester.itOnly` from `vitest` (globals are off); one valid and one invalid case per message id (`rawColour`, `defaultPalette`, `legacyToken`, `radius`, `border`, `ring`, `shadow`, `darkColour`, `transition`, `duration`, `easing`), plus every case listed under **Tests** in contracts/style-lint.md; confirm they fail
- [ ] T050 [US5] Implement the rule in `eslint-rules/clutch-style.js` per contracts/style-lint.md (inspected locations, nested literals, prefix and `!` stripping including arbitrary variants, patterns, message `Style guide: '<class>' is not allowed (<reason>). See clutch-ui-style.`); T049 passes
- [ ] T051 [US5] Register local plugin `clutch` with `clutch/style-tokens: 'error'` for `src/**/*.{ts,tsx}` in `eslint.config.js`; run `npm run lint` and fix every reported file until exit code 0 (SC-002)

**Checkpoint**: Quickstart rows 1–3 pass.

---

## Phase 8: Polish & Completion Gates

- [ ] T052 [P] Update `.claude/skills/clutch-ui-style/references/tokens.md` for D1: adopted Light and Dark values, the Dark values the reference lacks (`primary-tint`, `neutral-strong`, `neutral-strong-contrast`, `accent-navy`, status text), the opaque Dark chip backgrounds replacing "translucent", and the added `danger-solid`, `secondary-solid` (with contrasts) and `scrim` tokens
- [ ] T053 [P] Update `.claude/skills/clutch-ui-style/references/forms-components.md`: §4 rest label `fg-secondary` (D2), focus via the `focus-ring` utility (D5), label float by transform with `transition-[color,transform]`, and the FloatingField sketch rewritten to match (no `transition-all`, `ring-*` or `top` animation); §5 secondary button uses the `secondary-solid` pair
- [ ] T053a [P] Update `.claude/skills/clutch-ui-style/references/typography-motion-a11y.md` §9 focus-ring definition to the outline utility (D5), and `.claude/skills/clutch-ui-style/references/layout-navigation.md` §3 active item to the `primary` fill with `primary-contrast` text (D6)
- [ ] T054 Update `.claude/skills/clutch-ui-style/references/implementation.md`: §10.1 channel mapping without `<alpha-value>` (R1), shadcn variables retired rather than kept alongside (R3), `.dark` custom variant (D4); §10.2 adopted values; §10.3 the `clutch/style-tokens` rule replaces "eslint-plugin-tailwindcss or a custom rule", `cn` as the merge helper, `ErrorMessage` and `CardTitle` in the primitive list, `HatchedRegion` added with the first timeline (D7); §10.4 the `.dark` class runtime with no pre-paint script (D4). Then run `.\scripts\sync-agent-config.ps1 -From claude` from repo root to mirror into `.github/`
- [ ] T055 Create baselines once: `$env:STYLE_SCREENSHOTS='1'; npx playwright test --config playwright.style-guide.config.ts --update-snapshots --reporter=line`, then rerun with `STYLE_SCREENSHOTS=1` and without `--update-snapshots` to confirm they are stable; review every PNG in `e2e/style-guide.spec.ts-snapshots/` against the §11 checklist (SC-004)
- [ ] T056 Browser tests for critical journeys: `npx playwright test --reporter=line` (default config, which ignores the style-guide spec) plus `playwright.active-import.config.ts`, `playwright.transaction-delete.config.ts` and `playwright.ownership.config.ts` all pass; the only changed expectations are T020a's (WEB-001, SC-004, SC-005)
- [ ] T057 Validate the plan's §11 UI compliance checklist in both themes against the style-guide run and the reviewed baselines, and tick it in `specs/014-style-guide-compliance/plan.md` (WEB-001, `clutch-ui-style`)
- [ ] T058 Run completion quality gates per quickstart rows 1–8 (`vitest eslint-rules`, `lint`, `typecheck`, `test`, style-guide spec, journey specs, `build`, `npm audit --omit=dev`) and record results under **Results** in `specs/014-style-guide-compliance/quickstart.md` (ENG-001)
- [ ] T058a Independent security review per `clutch-security-review` over the full diff: OWASP Top 10, focused on the `AuthPage.tsx` form markup (field names, `autocomplete`, error text that leaks nothing new), the unchanged validation, and no new dependencies. Record findings under **Results** in `specs/014-style-guide-compliance/quickstart.md`; findings block completion (SEC-001)
- [ ] T059 Run `/speckit-converge`; complete any tasks it appends, then rerun T058 (constitution Workflow gate)

---

## Dependencies & Execution Order

- Setup → Foundational → US1 → US2 → US3 → US4 → US5 → Completion Gates.
- T005a is written before T004 and passes after T004 (and after T039 if a value changes).
- T004 removes shadcn variables, so existing screens look broken until their story tasks land; do not ship between T004 and T048.
- Test-first pairs: T006 → T011, T006a → T011a, T007 → T013, T012a → T012, T015a → T015, T018a → T018. T018 also needs T014.
- T047 needs T015 and runs before T019; story tasks then build on the migrated buttons. T020, T022–T046 need T011a (`ErrorMessage`).
- Every `e2e/style-guide.spec.ts` task (T019, T028, T036, T037, T041) needs T001–T002 and edits the same file, so they are sequential.
- T020a runs after T020 and before T027; T048 and T056 need it.
- US1 and US2 both edit `AccountsPage.tsx`, `AccountDetails.tsx`, `CategoriesPage.tsx`, `ImportLimitsPage.tsx`: T030 needs T022, T031 needs T023, T033 needs T025, T034 needs T026.
- T034a and T046 need T024 (same files). T038 edits `ThemeSelector.tsx`, which T020 places in the header but does not edit.
- T039 and T051 may change `src/index.css`/screens found by earlier stories; T051 must run last among code changes.
- T054 needs T052, T053 and T053a (it runs the sync).
- T055 runs after all screen changes (T048, T051). T057 needs T055. T058a runs after T058, and T059 runs after T058a.

## Parallel Opportunities

- Foundational: T005a, T005b, T006, T006a, T007, T008–T010, T012a, T014, T015a, T016, T017, T018a (separate files); then T011, T011a, T012, T013.
- US1: T022, T023, T024, T025, T026.
- US2: T029–T034.
- US4: T042–T046.
- Polish: T052, T053, T053a.

## Implementation Strategy

MVP = Foundational + User Story 1 (layered surfaces on every signed-in screen). Add US2 to complete the P1 scope, then US3, US4 and the lint gate in US5. Each story must pass its own style-guide states and the unchanged component tests before the next starts.
