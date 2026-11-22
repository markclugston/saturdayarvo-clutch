# Implementation Plan: Loan Payoff Timeline Group

**Branch**: `019-loan-payoff-timeline` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

## Summary

Replace the side-by-side Mortgage Burndown and Amortization Schedule cards with one full-width
"Loan Payoff Timeline" card that shows one view at a time, switched by an icon button at its top
right. The chosen view is a per-user preference stored like the 018 navigation preference
(user-keyed row, authenticated `GET`/`PUT`), loaded in parallel with the mortgages (2 s cap,
Burndown fallback) so the group never renders the wrong view first. Every switch saves at once;
a per-page-load client ID and sequence let the server ignore an older save that commits late.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).
Do not restate them.

**Feature-specific changes**:

- Schema: new table `UserLoanPayoffTimelinePreferences` + migration ([data-model.md](./data-model.md)).
- Endpoints: `GET`/`PUT /api/preferences/loan-payoff-timeline` ([contract](./contracts/loan-payoff-timeline-preferences.md)).
- Metrics: loan payoff timeline save outcome counter + duration histogram on the existing
  `Clutch.API.Preferences` meter.
- clutch-web: new `LoanPayoffTimeline` group, new `Tooltip` primitive (first tooltip in the app),
  preference query/save hooks, `MortgagesPage` layout and loading. No new packages.

**Performance Goals**: View changes synchronously on switch (FR-012, ≪ 500 ms); preference wait
capped at 2 s, and tests assert Burndown shows within 250 ms after the 2 s wait ends
(SC-006).

**Constraints**: No Burndown-then-Schedule swap (FR-007); every switch saves immediately with no
queue, debounce or merge, and the last choice wins (FR-006, [research R3](./research.md)); saves
use `keepalive` so a reload cannot cancel them; `clientId` and `clientSequence` share one
module-level page-load state; a late preference never applies; no localStorage.

**Scale/Scope**: One small row per user; one endpoint pair; one group component, one primitive.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
*Procedure: `clutch-constitution-check` skill. One row per ID; use N/A with a reason when an ID does not apply.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | `LoanPayoffTimelineView` in Domain; service in Application; entity/mapping in Infrastructure; endpoint maps HTTP only. UI in clutch-web. Tooltip primitive is required by FR-004, not extra. No live cross-device push, no per-mortgage setting. | Review: layering mirrors 018 (T031, T033) | PASS |
| DOT-001 | Yes | .NET 10, DI, async + cancellation, warnings as errors, as existing. | `dotnet build` 0 warnings; `dotnet test` 317/317 (T036) | PASS |
| DOT-002 | Yes | EF Core only; `AsNoTracking` PK read; serializable upsert with execution strategy plus the same-client sequence check inside the transaction. | Independent query review; SQL Server Testcontainers tests (default, round trip, isolation, superseded, parallel saves, cross-client last wins, invalid input) | PASS (T031 review; 12 SQL Server facts + 19 invalid-input cases in `LoanPayoffTimelinePreferenceTests`) |
| AUD-001 | No | Preference changes are not audit events (spec assumption, as 003/018). | — | N/A |
| ENG-001 | Yes | API integration + unit tests, Vitest component/hook tests, Playwright mocked and real-API journeys; all automated. | .NET 317/317; Vitest 513/513; style-guide 188/188; navigation 36/36; real-API mortgages 2/2 (T036) | PASS |
| OPS-001 | Yes | Additive migration (new table), `Down` drops it, no backfill; structured error log on save failure, no body; health checks unchanged. | Migration review T032; up/down SQL Server test | PASS |
| SEC-001 | Yes | `RequireAuthorization`; user from principal only; manual body read with 1 KB cap; allow-listed `view`, validated GUID and positive sequence (400 otherwise); DB check constraints; PUT behind existing antiforgery; Zod-validated responses. `clientId` only orders one user's own saves, never selects another user's row. No new dependencies. | Integration tests (401 on GET/PUT, antiforgery on PUT, invalid input); independent OWASP Top 10 + dependency review | PASS (T033: no findings; `dotnet list --vulnerable` none, `npm audit --omit=dev` 0) |
| SEC-002 | No | No configuration, secrets or integrations touched. | — | N/A |
| SEC-003 | No | A view choice is not personal, payment or financial data; logs omit bodies; ProblemDetails reveal nothing sensitive. Mortgage data handling is unchanged. | — | N/A |
| WEB-001 | Yes | TypeScript; React Query + Zod; existing `Button` icon variant; new token-only `Tooltip` primitive (hover + focus, Escape, hoverable: WCAG 2.2 SC 1.4.13); Title Case title and labels; hidden live status; axe in both themes. | Frontend gates (typecheck, lint, test, build, e2e), UI compliance checklist | PASS (lint, typecheck, build, unit, browser; checklist below, T034) |
| Perf & Observability | Yes | Switch updates the cache before the save; 2 s preference cap; `PreferenceMetrics` loan payoff timeline counter + histogram on the registered meter. | Switch within 500 ms tests; SC-006 browser test (2,000 ms wait, chart within 250 ms after); metrics unit test | PASS |

**Applicable style guide sections**:

- §2 Layout model (`layout-navigation.md`): one card on the content panel, full width, no
  borders; no page-level horizontal scroll at 320 px.
- §5 Components (`forms-components.md`): `Button` icon variant reused from the trash button;
  40×40 touch target; chart rules unchanged; tooltip becomes a new primitive (the "first feature
  adds a primitive" rule), and its guidance then lives in code.
- §6 Tokens (`index.css`): tooltip uses existing surface, text, radius and shadow tokens only.
- §7–9 Typography, motion, accessibility (`typography-motion-a11y.md`): Title Case heading and
  button text; tooltip motion within the allowed set and off under reduced motion; focus ring on
  the button; hidden status for screen readers.
- §11 Compliance checklist (below).

**UI compliance checklist** (style guide §11):

| Item | Check |
|---|---|
| [x] Only tokens used: no raw colours, default palette, non-token radius, extra ring or shadow, or `dark:` colour | Lint |
| [x] No borders or divider lines on layout containers (hairline utilities only) | Lint, Review |
| [x] Transitions, durations and easing within the allowed set; `prefers-reduced-motion` respected | Lint, Browser |
| [x] Surface hierarchy follows canvas, content, card, raised | Browser, Review |
| [x] Built from existing primitives and variants; none restyled ad hoc | Review |
| [x] Form fields use floating labels | Review (N/A: no fields added) |
| [x] Labels, headings and button text use Title Case; helper, error and body text use sentence case | Review |
| [x] % and $ fields use the shared formatted field (invalid characters never displayed, formatted on blur) | Component (N/A: none added) |
| [x] Navigation expand/collapse behaviour unchanged unless an approved spec amends it | Browser |
| [x] Dark theme has no pure black surface or pure white text | Browser |
| [x] Both themes verified (screenshots) | Browser |
| [x] WCAG 2.2 AA (axe) and contrast pass in both themes | Browser |
| [x] Visible focus ring on every interactive element | Browser |
| [x] Status not conveyed by colour alone | Review |

**Pre-research gate**: PASS. No violations; PENDING rows are implementation-time gates that need tasks.

## Project Structure

### Documentation (this feature)

```text
specs/019-loan-payoff-timeline/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── loan-payoff-timeline-preferences.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/Clutch.API/
├── Domain/Preferences/LoanPayoffTimelineView.cs                        # new (sibling: NavigationState)
├── Application/Preferences/LoanPayoffTimelinePreferenceService.cs      # new (sibling: NavigationPreferenceService)
├── Application/Preferences/PreferenceMetrics.cs                        # add loan payoff timeline instruments
├── Api/Endpoints/LoanPayoffTimelinePreferenceEndpoints.cs              # new (sibling: NavigationPreferenceEndpoints)
├── Infrastructure/Persistence/Entities/UserLoanPayoffTimelinePreference.cs  # new
├── Infrastructure/Persistence/AppDbContext.cs                          # DbSet + mapping
├── Infrastructure/Persistence/Migrations/*_AddLoanPayoffTimelinePreferences.cs  # new migration + snapshot
├── Infrastructure/DependencyInjection.cs                               # register service
└── Program.cs                                                          # map endpoints

tests/Clutch.API.Tests/Integration/Preferences/LoanPayoffTimelinePreferenceTests.cs  # new
tests/Clutch.API.Tests/Unit/Preferences/PreferenceMetricsTests.cs                    # extend

src/clutch-web/
├── src/lib/api/schemas.ts                                    # view + preference schemas
├── src/features/preferences/api.ts, api.test.ts              # get/save + hooks (2 s timeout, no scope)
├── src/components/ui/tooltip.tsx, tooltip.test.tsx           # new primitive
├── src/features/mortgages/LoanPayoffTimeline.tsx, .test.tsx  # new group + switch + status
├── src/features/mortgages/BurnDownChart.tsx, AmortizationSchedule.tsx (+ tests)  # drop own card/heading
├── src/features/mortgages/MortgagesPage.tsx, .test.tsx       # userId prop, parallel load, single group
├── src/App.tsx                                               # pass userId to MortgagesPage
├── e2e/style-guide.spec.ts (+ snapshots)                     # mock, both views, both themes, 320 px
└── e2e/mortgages.spec.ts                                     # persistence journeys (real API)

.claude/skills/clutch-ui-style/SKILL.md                       # list tooltip among primitives; sync .github/
```

**Structure Decision**: Existing layout, following the 018 navigation-preference siblings. The
tooltip primitive is the one new UI file outside the feature folder (no existing primitive).

## Phase 0 / Phase 1 outputs

- [research.md](./research.md): R1–R9 (storage, API, ordering of parallel saves, load gating,
  client state, button and tooltip, group container, metrics, e2e mocks).
- [data-model.md](./data-model.md), [contracts/loan-payoff-timeline-preferences.md](./contracts/loan-payoff-timeline-preferences.md), [quickstart.md](./quickstart.md).

### Post-Design Constitution Check

- ARC-001 PASS: layering mirrors 018; the only addition beyond 018's shape is the client
  sequence, needed for FR-006 without delaying saves.
- DOT-002 / OPS-001 PASS (design): PK lookup, no extra index; additive migration with drop-table
  rollback. Reviews are completion gates.
- SEC-001 PASS (design): no user ID in the contract; two-layer allow-list; sequence and client ID
  validated and scoped to the caller's own row. OWASP review is a completion gate.
- WEB-001 PASS (design): reuses the icon button; tooltip primitive meets SC 1.4.13; no swap on load;
  checklist to be evidenced at completion.
- Perf & Observability PASS (design): synchronous switch, 2 s cap, metrics on the existing meter.

**Post-design gate result**: PASS. No unresolved clarifications; no unjustified deviations.

## Complexity Tracking

No constitutional violations require justification.

## Completion Reviews (2026-11-22)

### T031 Independent query review (DOT-002)

| Query | Shape | Generated SQL (EF Core, SQL Server) | Index | Round trips | Outcome |
|---|---|---|---|---|---|
| `GetAsync` read | `AsNoTracking`, PK filter, scalar projection of `View` | `SELECT TOP(2) [View] FROM [UserLoanPayoffTimelinePreferences] WHERE [UserId] = @userId` | Clustered PK seek | 1 | PASS |
| `SaveAsync` upsert | Serializable transaction in the retrying execution strategy; tracked PK read, then the same-client sequence check in memory, then one `INSERT` or `UPDATE` (none when superseded) | `SELECT TOP(2) … WHERE [UserId] = @userId` (key-range lock under SERIALIZABLE), then `INSERT …` or `UPDATE … SET [View], [ClientId], [ClientSequence], [UpdatedAtUtc] WHERE [UserId] = @userId` | Clustered PK; no extra index needed | 2 (read, write); 1 when superseded | PASS |

- No client evaluation; no N+1; no audit row read or written (AUD-001 N/A).
- Concurrent first saves can deadlock on the key-range lock; `EnableRetryOnFailure` retries the
  whole transaction (1205 is transient). Covered by the 12-way parallel SQL Server test.
- No bottleneck found. No findings.

### T032 Migration review (OPS-001)

`20261121222202_AddLoanPayoffTimelinePreferences`: creates one new table with PK, cascade FK to
`AspNetUsers`, and the `View` and `ClientSequence` check constraints. Additive only: no change to
existing tables or data, so no data-loss risk. Rollback: `Down` drops the table (verified by the
SQL Server migration test, which migrates up then down to `RenameMortgageDetailFields`). No
backfill: a missing row reads `Burndown`. Audit table untouched. No findings.

### T033 Independent security review (SEC-001, OPS-001, SEC-003 rationale)

| Check | Result |
|---|---|
| A01 Access control | Both endpoints `RequireAuthorization`; user id only from the principal; row keyed by user id; `clientId` only orders the caller's own saves. 401 tests for GET and PUT; cross-user isolation test. PASS |
| A02 Cryptography | None involved. `crypto.randomUUID()` is an ordering id, not a secret. PASS |
| A03 Injection | EF Core parameters only; body parsed with `JsonDocument` after a 1,024-byte bounded read. PASS |
| A04 Insecure design | Allow-listed `view`; non-empty GUID; sequence 1..2^53 − 1; DB check constraints as second layer. A client can only order its own page's saves. PASS |
| A05 Misconfiguration | No configuration changes; PUT behind the existing antiforgery filter (tested: no token → 400, nothing saved). PASS |
| A06 Vulnerable components | No packages added. `dotnet list … --vulnerable`: none; `npm audit --omit=dev`: 0. Tooltip built on the already-approved `@base-ui/react`; no third-party UI code copied. PASS |
| A07 Authentication | Existing cookie auth unchanged. PASS |
| A08 Integrity | Responses Zod-validated on the client; save responses never written to the cache. PASS |
| A09 Logging | Save failure logs a fixed message template with the exception, no request body; the `View` is not sensitive. The 400 ProblemDetails has a fixed title and detail and echoes no input. PASS |
| A10 SSRF | No outbound requests. PASS |
| SEC-003 N/A rationale | Confirmed: a view choice is not personal, payment or financial data. |

No findings.
