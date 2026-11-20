# Implementation Plan: Style Guide Compliance

**Branch**: `014-style-guide-compliance` | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

## Summary

This feature brings every clutch-web screen and dialog into line with the `clutch-ui-style` guide.

- **Tokens**: replace the shadcn default variables in `index.css` with the guide's tokens for Light and Soft Dark. Several values are adjusted so they pass WCAG AA (research R4).
- **Primitives**: add the guide's primitives to `components/ui/`, then rebuild each screen from them without changing behaviour.
- **Lint**: add a local ESLint rule that fails on any forbidden style pattern.
- **Browser checks**: add a Playwright spec that takes screenshots, runs axe, a focus sweep and computed-style surface checks on 23 states, in both themes, at 1024 and 1440px.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**:
- **Tokens** (`index.css`): new token set, `@utility focus-ring` (a 2px `primary` outline with a 2px offset, D5), `@utility hairline-t` and `hairline-b`, the base `body` rule on `bg-canvas text-fg text-sm`, and a global reduced-motion rule. The shadcn variables are removed (R1–R5).
- **New primitives**: `AppShell` (header, nav and content slots), `SideNav` and `SideNavItem`, `ContentPanel`, `Card` and `CardTitle`, `FloatingField`, `ErrorMessage`, `Chip`, `StatusChip` and `Tooltip`. `Button` is rewritten and `Dialog` is restyled ([contracts/ui-primitives.md](contracts/ui-primitives.md)).
- **Lint rule**: the local ESLint rule `clutch/style-tokens` ([contracts/style-lint.md](contracts/style-lint.md)).
- **Browser checks**: new config `playwright.style-guide.config.ts` and spec ([contracts/visual-states.md](contracts/visual-states.md)). Screenshots are gated by `STYLE_SCREENSHOTS=1` so baselines are created only once. The default `playwright.config.ts` ignores the new spec, so journey runs do not pick it up.
- **Existing test expectations**: two navigation layout expectations in `e2e/navigation.spec.ts` change, as SC-004 allows (R10). No other existing test changes.
- **Dependencies**: no new packages. `Tooltip` uses the existing `@base-ui/react`. Class merging uses the existing `cn` package (shadcn's clsx and tailwind-merge replacement); a unit test confirms it keeps the custom token utilities apart.
- **Backend**: no backend, API or schema changes.

**Performance Goals**: Constitution defaults. Transitions run for 150–250ms; with reduced motion they run for under 50ms (FR-012).

**Constraints**:
- **Desktop only**: minimum width 1024px, with no horizontal page scroll. Existing browser tests at 320–390px must still pass (spec Edge Cases).
- **Behaviour frozen**: nav triggers, accessible names, roles, validation and step counts do not change (FR-011, FR-014).
- **Theme runtime**: the `.dark` class runtime is kept (R2).

**Scale/Scope**: 7 screens plus sign-up mode and the session load error screen, 3 dialogs, the inline delete category panel, the theme selector, the header and the shell. About 20 `.tsx` files plus `index.css`. There are 23 visual states × 2 themes × 2 viewports.

## Constitution Check

*Gate: passed before Phase 0 and re-checked after Phase 1 design and after `/speckit-analyze` remediation. Procedure: `clutch-constitution-check`.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | The UI changes stay in clutch-web. No new features, screens or behaviour (FR-014). The style lint rule is required by FR-013. | Review | Pass |
| DOT-001 | No | No .NET changes. | — | N/A |
| DOT-002 | No | No data access changes. | — | N/A |
| AUD-001 | No | No audit records are created or read. | — | N/A |
| ENG-001 | Yes | RuleTester tests for the lint rule. Component tests for the new primitives cover floating label, merged `aria-describedby`, `ErrorMessage` and `StatusChip` text and role passthrough, side-nav current fill and tooltips, chip remove and button variants. A token contrast unit test covers every text, status, control and focus-ring pair in both themes. A `cn` unit test covers token merging. The browser spec runs axe, a focus sweep and computed-style surface checks on every state. Existing component and journey tests stay unchanged except the two navigation layout expectations SC-004 lists. All checks are agent-run (quickstart). | Test tasks; lint, unit, browser, build and audit gates | Pass (tasks must include these) |
| OPS-001 | No | No services, logging or migrations. | — | N/A |
| SEC-001 | Yes (marginal) | The sign-in form markup is rebuilt with `FloatingField`. Validation, submission, auth flow and dependencies do not change. | Independent security review over the full diff (T058a) | Pass (task required) |
| SEC-002 | No | No secrets. | — | N/A |
| SEC-003 | No | No change to how financial data is handled or shown (presentation styling only). | — | N/A |
| WEB-001 | Yes | TypeScript only. Tokens and primitives follow the guide. Contrast is fixed at token level (R4). The lint rule enforces the token rules. Every style-guide reference that this change contradicts is updated in the same change (T052–T054). No third-party UI code is added (Tooltip uses the existing Base UI). | Lint, unit and browser tests (axe, focus sweep, surface checks and screenshots), the UI compliance checklist below, synchronized style-guide update | Pass with justified deviations D1–D7 |
| Perf & Observability | Yes (UI) | All feedback states stay as they are. No new user actions. Metrics are unaffected (frontend only). | Existing journey tests | Pass |

### Applicable style guide sections

- §2 Layout model
- §3 Navigation
- §4 Form controls
- §5 Components (buttons, status chips, selected rows; stat cards and charts are not used)
- §6 Tokens (both themes)
- §7 Typography
- §8 Motion
- §9 Accessibility
- §10 Implementation
- §11 Compliance checklist

### UI compliance checklist (§11)

- [ ] No borders or divider lines on layout containers (documented hairline exception only)
- [ ] Surface hierarchy follows canvas, content, card, raised
- [ ] Only tokens used: no raw hex, no default palette, no non-token radius
- [ ] Form fields use floating labels (exceptions D3)
- [ ] Navigation expand/collapse behaviour unchanged; only restyled
- [ ] Dark theme has no pure black surface or pure white text
- [ ] Both themes visually verified
- [ ] WCAG 2.2 AA contrast checked in both themes
- [ ] Visible focus ring on every interactive element
- [ ] Status not conveyed by colour alone
- [ ] `prefers-reduced-motion` respected

### Justified deviations from the style guide

| # | Deviation | Justification |
|---|---|---|
| D1 | Token values differ from the guide reference: Light `fg-secondary`, `primary`, danger, warning, success and info text; Dark `fg-secondary`, `primary`, `primary-contrast` and danger text. Values the reference does not define: Dark `primary-tint`, `neutral-strong`, `neutral-strong-contrast`, `accent-navy`, and Light `neutral-strong-contrast`. Dark status chip backgrounds are opaque (the text colour at 14% over `card`) rather than translucent. Added tokens: `danger-solid` / `danger-solid-contrast`, `secondary-solid` / `secondary-solid-contrast` and `scrim` | The reference values fail WCAG 2.2 AA (R4), including Dark secondary and primary text on the `hover` fill. The danger and secondary buttons change colour by theme (§5), so each needs a theme-switched pair because colour `dark:` variants are forbidden (FR-013). The dialog backdrop needs a scrim that darkens the page in both themes. Opaque chip backgrounds make contrast measurable in unit tests. `index.css` is the source of truth; `references/tokens.md`, `forms-components.md` §5 and `implementation.md` §10.2 are updated in the same change. |
| D2 | Floating labels at rest use `fg-secondary`, not `fg-muted`; the label floats with `transform` and `transition-[color,transform]`, not by animating `top` and font size | `fg-muted` is 2.25–3.0:1 on `raised`, which fails AA for label text (R4). §8 allows only colour, opacity, transform and width to animate. Update the `references/forms-components.md` §4 text and sketch to match. |
| D3 | Non-floating labels: the import duplicate-confirmation checkbox, the hidden CSV file input, and the inline category rename (sr-only label) | The guide does not cover checkboxes; the file input's visible control is a button; the inline rename keeps its row layout and step count (R8). None of these adds a visible external label to a text field. The checkbox and the `#csv-file` input are in `ImportPage.tsx`. The file input's existing visible label text stays as token-styled text, and its accessible name does not change. |
| D4 | The theme stays on the `.dark` class with no pre-paint script, rather than `data-theme` (§10.4) | The theme runtime is settled (spec Assumptions, R2). Update `references/implementation.md` §10.1 and §10.4 to match the actual runtime. |
| D5 | The `focus-ring` utility is a 2px `primary` outline with a 2px offset, not a `ring-2 ring-offset-2 ring-offset-canvas` box-shadow | Existing browser tests assert a visible outline (style, width, colour contrast) on focused controls, and SC-004 keeps them unchanged. An outline gives the same 2px primary ring with a 2px offset (§9) and a transparent offset on every surface. Update `references/typography-motion-a11y.md` §9. |
| D6 | The current navigation item uses the `primary` fill with `primary-contrast` text, not the `selected` tint | `selected` is 1.16:1 (Light) and 1.35:1 (Dark) against `canvas`, below the 3:1 a state indicator needs (WCAG 1.4.11) and below the existing navigation test. `primary` is 5.49:1 and 7.45:1. Hover keeps the `hover` fill. Update `references/layout-navigation.md` §3. |
| D7 | `HatchedRegion` is not added (§10.3 lists it) | No timeline or calendar exists (spec Assumptions). Update `references/implementation.md` §10.3 to say it is added with the first timeline. |

## Project Structure

### Documentation (this feature)

```text
specs/014-style-guide-compliance/
├── plan.md
├── research.md
├── quickstart.md
├── contracts/
│   ├── design-tokens.md
│   ├── ui-primitives.md
│   ├── style-lint.md
│   └── visual-states.md
└── tasks.md             # /speckit-tasks output
```

`data-model.md` is omitted because no entities or schema change. The token catalogue is in `contracts/design-tokens.md`.

### Source Code (files this feature touches)

```text
src/clutch-web/
├── eslint.config.js                       # register clutch/style-tokens
├── eslint-rules/
│   ├── clutch-style.js                    # new
│   └── clutch-style.test.js               # new
├── playwright.config.ts                   # testIgnore style-guide.spec.ts
├── playwright.style-guide.config.ts       # new
├── e2e/
│   ├── navigation.spec.ts                 # two layout expectations updated (SC-004)
│   ├── style-guide.spec.ts                # new
│   ├── style-guide.spec.ts-snapshots/     # new baselines
│   ├── import-mapping-layout.spec.ts-snapshots/   # removed (empty, untracked, R7)
│   ├── ui-compliance/                     # removed (empty, untracked)
│   └── test-results/                      # removed (stray, untracked)
└── src/
    ├── index.css                          # tokens, utilities, body rule, reduced motion
    ├── tokens.contrast.test.ts            # new
    ├── lib/utils.test.ts                  # new (cn merging of token utilities)
    ├── App.tsx                            # AppShell/SideNav/ContentPanel, header and session error restyled; triggers unchanged
    ├── components/
    │   ├── theme/ThemeSelector.tsx        # FloatingField select, ErrorMessage
    │   └── ui/
    │       ├── app-shell.tsx              # new
    │       ├── side-nav.tsx               # new (+ side-nav.test.tsx)
    │       ├── content-panel.tsx          # new
    │       ├── card.tsx                   # new (Card, CardTitle, CardFooter)
    │       ├── floating-field.tsx         # new (+ floating-field.test.tsx)
    │       ├── error-message.tsx          # new (+ error-message.test.tsx)
    │       ├── chip.tsx                   # new (+ chip.test.tsx)
    │       ├── status-chip.tsx            # new (+ status-chip.test.tsx)
    │       ├── tooltip.tsx                # new
    │       ├── button.tsx                 # rewritten variants (+ button.test.tsx)
    │       ├── dialog.tsx                 # restyled
    │       └── page-heading.tsx           # title style
    └── features/
        ├── auth/AuthPage.tsx, StartupLoadingDialog.tsx
        ├── accounts/AccountsPage.tsx, AccountDetails.tsx, TransactionsTable.tsx, DeleteTransactionDialog.tsx
        ├── imports/ImportPage.tsx, ImportMappingForm.tsx, ImportReviewTable.tsx, ImportEndedDialog.tsx
        ├── categories/CategoriesPage.tsx, DeleteCategoryDialog.tsx
        └── admin/ImportLimitsPage.tsx

.claude/skills/clutch-ui-style/references/
├── tokens.md, forms-components.md, implementation.md,
├── typography-motion-a11y.md, layout-navigation.md   # synchronized updates (D1–D7)
.github/                                   # mirrored via scripts/sync-agent-config.ps1 -From claude
```

`App.test.tsx` and every other existing component test stay unchanged. Their class assertions (`cursor-pointer` on nav items, `text-xl`, `mt-6` and indent padding in the category tree, `text-right` in the review table) are kept by the rebuilt markup.

**Structure Decision**: Existing layout. The new primitives sit beside `button.tsx` and `dialog.tsx` and use the same kebab-case file names. The lint rule goes in the existing empty `eslint-rules/` folder. The Playwright config follows the sibling `playwright.*.config.ts` files.

## Complexity Tracking

No constitutional violations. The style-guide deviations D1–D7 are justified in the table above, as `clutch-constitution-check` requires.

| Deviation | Why needed | Simpler alternative rejected because |
|---|---|---|
| D1–D7 (style guide) | See the deviations table | Following the reference exactly fails WCAG 2.2 AA, the frozen browser tests, or describes a runtime and primitives the app does not have |
