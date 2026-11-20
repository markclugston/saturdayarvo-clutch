# Research: Style Guide Compliance

Contrast ratios below were computed with the WCAG 2.x relative-luminance formula. They are checked again by the token contrast unit test (T005a) and in the browser by axe (SC-003).

## R1 Token format in Tailwind v4

- **Decision**: Keep space-separated RGB channel custom properties (`--surface-card: 255 255 255;`) and map them as `--color-card: rgb(var(--surface-card));` in `@theme inline`. Do not use `<alpha-value>`.
- **Rationale**: `<alpha-value>` is Tailwind v3 config syntax. Tailwind v4 applies opacity modifiers (`bg-primary/10`) to any colour via `color-mix`, so the channel format still works. `references/implementation.md` §10.1 shows `<alpha-value>` and is corrected in T054.
- **Alternatives**: Hex or `oklch` values. Rejected because the style guide (§10.2) requires the channel format.

## R2 Theme selector for tokens

- **Decision**: Put the Soft Dark values under the selector the existing `ThemeProvider` already uses (`.dark` on `<html>`). Keep `@custom-variant dark (&:is(.dark *))` for non-colour needs only. Do not change to `data-theme`, and do not add an inline pre-paint script.
- **Rationale**: The spec treats the theme runtime as settled (`src/clutch-web/src/components/theme/ThemeProvider.tsx`). §10.4's `data-theme` attribute and pre-paint script describe a runtime this app does not use: the mode comes from the server-side preference after sign-in, and Light is the default before that.
- **Alternatives**: Switch to `data-theme`. Rejected because it changes the settled runtime and its tests for no user-visible gain.

## R3 Retire shadcn/ui default variables

- **Decision**: Replace the shadcn variables (`--background`, `--foreground`, `--muted*`, `--border`, `--input`, `--ring`, `--destructive*`, `--sidebar*`, `--chart-*`, `--radius*`) with the style guide tokens. Remove the `* { @apply border-border outline-ring/50 }` base rule. Change the `body` base rule to `bg-canvas text-fg text-sm` (14px body text, §7). The lint rule forbids the old class names.
- **Rationale**: Two token sets let screens keep using the default library palette. The spec Assumptions note that `index.css` holds library defaults only. `references/implementation.md` §10.1 says the tokens sit "alongside the existing shadcn/ui variables"; T054 corrects that.
- **Alternatives**: Alias the shadcn names to the new tokens. Rejected because aliases keep the non-guide names in use and hide deviations.

## R4 Token values that fail WCAG 2.2 AA

The guide's reference hex values fail AA in several pairs. `index.css` wins over the reference (skill rule), so the values below are adopted and `references/tokens.md` is updated in the same change (WEB-001 synchronized update).

| Token (theme) | Guide value | Problem | Adopted value | Result |
|---|---|---|---|---|
| `fg-secondary` (Light) | `#6B7280` | 4.28:1 on `raised`, 4.44:1 on `content` | `#5F6673` | 5.11 on raised, 5.31 on content, 4.89 on hover |
| `primary` (Light) | `#1F6BFF` | 4.19:1 as text on `content` | `#1A5FE6` | 5.49 with white text, 4.86 on raised, 4.65 on hover |
| `danger` text (Light) | `#D93025` | 4.18:1 on chip background | `#C5221F` | 5.08 |
| `warning` text (Light) | `#D97706` | 2.87:1 | `#9A5B00` | 4.89 |
| `success` text (Light) | `#1E9E5A` | 3.08:1 | `#167A45` | 4.81 |
| `info` text (Light) | `#2563EB` | 4.50:1, at the threshold | `#1D4ED8` | 5.83 |
| `fg-secondary` (Dark) | `#A0A0A6` | 4.22:1 on `hover` | `#ABABB1` | 4.80 on hover, 5.27 on raised |
| `primary` (Dark) | `#4C8DFF` | 4.29:1 as text on `card`; the first adjustment `#6AA0FF` is still 4.22:1 on `hover` | `#7EAEFF` | 6.14 on card, 5.38 on raised, 4.90 on hover |
| `primary-contrast` (Dark) | `#FFFFFF` | 3.20:1 on primary | `#0B1220` (guide's alternative) | 8.37 |
| `danger` text (Dark) | not in the guide | `#F28B82` is 4.504:1 on its chip, too close to the threshold | `#F59C94` (chip `#493D3E`) | 4.98 on chip, 6.58 on card |

- **`fg-muted`** (2.25–3.0:1 in both themes) is used only for disabled text and decorative icons, never for readable text. Disabled controls are exempt from contrast requirements under WCAG.
- **Floating labels at rest** use `fg-secondary`, not `fg-muted` as §4 suggests (deviation D2 in plan.md).
- **Soft Dark status chips** use an opaque background equal to the text colour at 14% over `card` (values in contracts/design-tokens.md), with lightened text: danger `#F59C94`, warning `#FBBF5A`, success `#6FD39B`, info `#8AB4FF`, neutral `#C4C7CE`. They measure 4.98–6.05:1 on their chips.
- **Current navigation item**: the `selected` tint is 1.16:1 (Light) and 1.35:1 (Dark) against `canvas`, so it cannot be the only indicator of the current item. The current item uses `primary` (5.49:1 and 7.45:1 against `canvas`) with `primary-contrast` text (D6).
- **Rationale**: SC-003 requires zero contrast violations in both themes.
- **Alternatives**: Keep the guide values and accept axe failures. Rejected because this violates WEB-001.

## R5 Allowed exceptions as named utilities (FR-013)

- **Decision**: Define the allowed exceptions as `@utility` rules and one theme token in `index.css`:
  - `focus-ring`: `outline: 2px solid rgb(var(--primary)); outline-offset: 2px`. Applied as `focus-visible:focus-ring` (D5).
  - `hairline-t` and `hairline-b`: a 1px border in `fg` at 7% opacity.
  - `shadow-float`: a `--shadow-float` theme token.
- **Rationale**: The lint rule can then reject every raw `ring-*`, `outline-*`, `border*`, `divide-*` and `shadow-*` class without folder exemptions, while the CSS uses those properties internally. The focus ring is an outline rather than §9's box-shadow ring because existing browser tests (`navigation.spec.ts`, `accounts-transaction-delete.spec.ts`) assert the focused control's outline style, width and colour contrast, and SC-004 keeps them unchanged. An outline offset is transparent, so the ring reads correctly on every surface.
- **Alternatives**: A box-shadow ring (§9 sketch). Rejected because it fails the frozen tests. Allow-listing `ring-2 ring-primary` combinations in lint. Rejected because they are hard to match reliably and easy to misuse.

## R6 Automated style check

- **Decision**: Add a local ESLint plugin in `src/clutch-web/eslint-rules/` (the folder exists and is empty), registered in `eslint.config.js` as rule `clutch/style-tokens` at error level for every `src/**/*.{ts,tsx}` file.
  - It checks string and template literals as listed in contracts/style-lint.md (`className`/`*ClassName` attributes, `cn`/`cva`/`clsx`/`twMerge` arguments, and `*Class`/`*Classes`/`*ClassName` variables).
  - It removes variant prefixes from each class (`hover:`, `focus-visible:`, `dark:`, arbitrary variants such as `[&_:focus-visible]:`, …) before matching.
  - It reports the file, line and the offending class.
- **What it forbids**: the patterns in contracts/style-lint.md. A test file `eslint-rules/clutch-style.test.js` uses ESLint `RuleTester`; it runs in Vitest. Vitest globals are off in `vite.config.ts`, so the test assigns `RuleTester.describe`, `RuleTester.it` and `RuleTester.itOnly` from the `vitest` imports; otherwise RuleTester runs the cases at import time and Vitest reports no tests.
- **Rationale**: Linting runs in the existing `npm run lint` gate (SC-002, US5). No new dependency is needed. `eslint-plugin-tailwindcss` does not support Tailwind v4 custom tokens well, and it cannot express "only these utilities".
- **Scope note**: `src/index.css` defines the tokens, so it contains raw channel values by design. The rule covers component source (`.ts`/`.tsx`), which is where FR-013's patterns can appear. This is not a folder exemption: every TS/TSX file, including `components/ui/`, is checked. Class strings held anywhere else (for example a plain object not named `*Class` and not passed to a merge helper) are not inspected; the primitives use `cva`, so variant strings are covered.
- **Alternatives**: A grep script in CI. Rejected because there is no CI workflow in the repo, and lint is already the gate.

## R7 Visual and accessibility checks (SC-001, SC-001a, SC-003)

- **Decision**: Add a new browser spec `e2e/style-guide.spec.ts` with config `playwright.style-guide.config.ts`.
  - **API**: all API calls are mocked with `page.route` (as `e2e/navigation.spec.ts` already does), so data is deterministic and no backend is needed. Failed submissions are mocked as 400 ProblemDetails responses so each form shows its existing form-level message (R11).
  - **Projects**: two, `desktop-1024` (1024×768) and `desktop-1440` (1440×900).
  - **Themes**: each test runs for Light and Dark by mocking the theme preference response; pre-auth states add the `.dark` class directly.
  - **Screenshots**: `toHaveScreenshot` with animations disabled and `reducedMotion: 'reduce'`.
  - **Accessibility**: `AxeBuilder` with tags `wcag2a, wcag2aa, wcag21aa, wcag22aa` on each state, plus a focus sweep.
  - **Surface checks**: computed-style assertions on every state, in both themes: nav background is `canvas`, the content panel is `content`, cards are `card`, layout containers have zero border width, and radii match the tokens. These make US1's acceptance scenarios testable before baselines exist, so test-first runs fail on the current screens.
  - **No horizontal page scroll**: asserted as `scrollWidth <= clientWidth`.
  - **Default config**: `playwright.config.ts` has no `testMatch`, so it gets `testIgnore: ['style-guide.spec.ts']`. Otherwise `npx playwright test` would run the spec at 1280×720 without reduced motion and its motion assertions would fail.
- **States covered**: listed in contracts/visual-states.md.
- **Baselines**: The `e2e/import-mapping-layout.spec.ts-snapshots/` folder has no spec. It is empty and untracked, as are `e2e/ui-compliance/` and `e2e/test-results/`; they are deleted locally and nothing is committed for them. The new baselines are generated once and reviewed (SC-004). Baselines use Playwright's platform suffix (`-win32`), because there is no CI workflow.
- **Rationale**: Mocked data avoids flaky screenshots. Two viewport projects give both sizes without duplicating tests.
- **Alternatives**: Run against the real test API (`start-test-api.mjs`). Rejected for screenshots because the data is not stable. Existing journey specs keep using it.

## R8 Fields that keep a non-floating label

- **Decision**: All text inputs and selects use `FloatingField`, including the theme selector and import mapping selects. Three exceptions:
  - **Duplicate-confirmation checkbox** on the import review step in `ImportPage.tsx` ("I reviewed the possible duplicates…"): a label beside a checkbox is the standard pattern. §4 covers text inputs, selects and textareas only. The checkbox uses `accent-primary` and `focus-visible:focus-ring`.
  - **Hidden file input** (`#csv-file`): the visible control is the "Choose CSV file" button (clutch-frontend rule), so the input has no visual label of its own beyond the existing "CSV file" text.
  - **Inline category rename** in `CategoriesPage.tsx`: it keeps its visually hidden (`sr-only`) label and compact row height, so the tree row layout and step count stay unchanged (FR-014, SC-005). It is not an external visible label. It still uses the `raised` tone, `rounded-control` and `focus-ring`.
- **Rationale**: FR-006 requires a documented justification for any non-floating label.

## R9 Navigation widths, current item and motion

- **Decision**: The rail placeholder becomes `w-16` (64px). The overlay nav becomes `w-16`, or `w-60` (240px) when expanded, with `transition-[width] duration-200 ease-in-out`. Labels use `transition-opacity duration-200`; the `hidden` toggle is kept so accessible names and tests do not change.
  - Items keep the `cursor-pointer` class (asserted by `App.test.tsx`). Icons become `size-5` (20px, §3).
  - The current item uses `aria-[current=page]:bg-primary aria-[current=page]:text-primary-contrast font-semibold` (D6); hover uses `hover:bg-hover`.
  - A global `@media (prefers-reduced-motion: reduce)` rule in `index.css` sets `transition-duration` and `animation-duration` to `0.01ms`.
  - The `Tooltip` primitive uses `@base-ui/react/tooltip` (already a dependency), so no new third-party code is added.
- **Rationale**: FR-011 and FR-012. The triggers in `App.tsx` stay unchanged. The existing navigation test requires the current item's fill to reach 3:1 against the page background.
- **Alternatives**: Per-component `motion-reduce:` classes. Rejected because they are easy to miss. The `selected` tint plus an indicator bar. Rejected because the frozen test measures the item's background.

## R10 Content panel and navigation overlay

- **Decision**: `ContentPanel` is the `main` element and uses `m-2 lg:m-3` (gutter) and `p-4 xl:p-6`. Cards use `p-3 xl:p-5` with `space-y-3` or `gap-3` between them. Tables sit inside `overflow-x-auto` within their card. The old `max-w-5xl mx-auto` main wrapper becomes the panel's inner content width.
  - Because the panel's margins are equal on both sides, the existing check that `main` is centred beside the collapsed nav still holds.
  - At 1280px the heading starts at about x=160, under the 240px expanded overlay. FR-011 requires the overlay, so the one `navigation.spec.ts` assertion that the expanded nav ends before the heading at widths above 320px is replaced by the geometry check the same test already makes (content does not move or resize when the nav expands). The collapsed width expectation changes from `56px` to `64px`. These are the two expectation changes SC-004 allows.
  - At 320–390px the panel keeps `m-2 p-4`, and tables and long names scroll inside their cards, so the existing narrow-viewport tests still pass.
- **Rationale**: Covers the 1024px edge case with no horizontal page scroll, and keeps the overlay behaviour FR-011 requires.
- **Alternatives**: Cap the inner content at about 864px so the heading clears the overlay at 1280px. Rejected because it narrows wide tables for every user to protect a test expectation the spec no longer supports.

## R11 Form error states

- **Decision**: Forms keep their validation: native `required` checks and one form-level message from the server after a failed submission. The "errors" states mock a 400 ProblemDetails response and show that message through a new `ErrorMessage` primitive (danger text plus an `aria-hidden` icon, keeping `role="alert"` and the existing wording). `FloatingField` supports an optional `error` prop for future use, but no screen passes one.
- **Rationale**: Field-level errors would be new behaviour (FR-014). Native validation bubbles are not visible to screenshots or axe.
- **Alternatives**: Map ProblemDetails field errors onto fields. Rejected as a behaviour change outside this feature.

## R12 Inline delete category panel

- **Decision**: `DeleteCategoryDialog` stays an inline, non-modal `role="alertdialog"` panel inside the category tree. It is restyled as `bg-raised rounded-card p-4` with no border and no shadow. The existing warning sentence keeps its text and gains an `aria-hidden` warning icon in `text-warning` (a full sentence is too long for a chip), and the delete action is a `Button variant="danger"` with its existing explicit text. Focus, Escape and step behaviour do not change.
- **Rationale**: FR-005 allows shadows on floating elements only, and FR-014 freezes behaviour. On a `card` surface the `raised` tone separates the panel without a border.

## R13 Startup loading dialog

- **Decision**: `StartupLoadingDialog` keeps its own markup (a fixed backdrop with `data-slot="startup-backdrop"` and a `role="status"` panel), which `startup.spec.ts` relies on for focus, Escape and inert behaviour. It is restyled in place: backdrop `bg-scrim/40`, panel `bg-card rounded-card shadow-float`, text tokens only. It is not moved onto the `Dialog` primitive.
- **Rationale**: Moving it onto Base UI `Dialog` would add a focus trap and Escape handling, which changes behaviour (FR-014).
- **Note**: The spinner keeps `animate-spin`. It is a continuous loading indicator, not a transition, so §8's 150–250ms bound does not apply; the global reduced-motion rule shortens it.
