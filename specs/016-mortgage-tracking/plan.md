# Implementation Plan: Mortgages Screen

**Branch**: `016-mortgage-tracking` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

## Summary

Add a Mortgages destination above Categories. A signed-in user keeps up to 20 mortgages, each with
loan details and 1–60 interest rate changes, edited one at a time in a Loan details panel under a
tab strip. The API stores mortgages per owner with server-side validation, an integer concurrency
version (409 on clashes) and one audit event per create, update and delete. The Amortization
Schedule (N + 1 placeholder rows, windowed) and Burn Down chart (inline SVG skeleton) are
display-only placeholders; no amortization values are calculated.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**:

- Schema: new `Mortgages` and `MortgageInterestRateChanges` tables (one migration). See [data-model.md](data-model.md).
- Endpoints: `GET/POST /api/mortgages`, `PUT/DELETE /api/mortgages/{id}`. See [contracts/mortgages-api.md](contracts/mortgages-api.md).
- Domain: `Domain/Mortgages/` with the final-repayment-date rule (FR-019) and validation (FR-007).
- Metrics: new `Clutch.API.Mortgages` meter (save/delete outcomes and duration).
- UI: new `features/mortgages/` area; `Mortgages` nav item; app-wide unsaved-changes guard used by navigation, sign-out, `beforeunload` and sign-in expiry; "Mortgage saved" toast via Base UI Toast (already a dependency). See [contracts/mortgages-ui.md](contracts/mortgages-ui.md).
- No new packages (research R1, R2).

**Performance Goals**: Constitution defaults; tab switch shows details in under 1 s with 5 mortgages
(SC-003) because all mortgages load in one request and switching is client-side. Schedule rendering
stays responsive up to ~522,000 rows (weekly from 1 Jan 0001 to 31 Dec 9999) through windowing (R3).

**Constraints**: Server enforces every FR-007 rule including limits (20 / 60), uniqueness ignoring
case after trimming, and the 31 Dec 9999 bound. "Not later than today" is checked against the
user's local date on screen and against the latest time zone (UTC+14) on the server (R5).

**Scale/Scope**: ≤ 20 mortgages × ≤ 60 rate changes per user; one screen, four endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | Validation and final-date rule in `Domain/Mortgages` (no HTTP/EF types); persistence in `Application`/`Infrastructure`; UI only in clutch-web. Only spec'd behaviour; no calculations (FR-016). | Review | PASS |
| DOT-001 | Yes | .NET 10, async + `CancellationToken`, typed validation failures: `MortgageValidator` (Domain) returns field errors and `MortgageService` (Application) turns them into `ApiProblemException` with `errors`, so the domain throws no exceptions for control flow and has no `Api` dependency (ARC-001). | Build, tests | PENDING |
| DOT-002 | Yes | EF Core only; `AsNoTracking` list read with one query (mortgages + rate changes via `Include`); unique index for names; serializable transaction for the 20-limit (R6). SQL Server integration tests for ownership, uniqueness, concurrency, cascade delete, migration. | Independent query review, provider-backed integration tests | PENDING |
| AUD-001 | Yes | `MortgageCreate` / `MortgageUpdate` / `MortgageDelete` rows added to `Audit` in the same `SaveChanges` as the change; descriptions carry the name only, no balances or rates. No audit update/delete. | Audit append-only check, integration test: exactly one row per operation (SC-008) | PENDING |
| ENG-001 | Yes | Unit tests (domain rules, final-date edge cases), integration tests (endpoints, ownership, 409, limits, audit), Vitest component tests (page, form, guard, schedule, chart, toast), Playwright journey `mortgages.spec.ts` + axe in style-guide spec. | Test tasks, quality gates | PENDING |
| OPS-001 | Yes | Structured logs with mortgage IDs only, asserted by a log-capture integration test (in-test `ILoggerProvider`, no new package); existing DB health check covers the new tables; migration adds two tables (no data loss; rollback = `Down` drops them). | Logging, health checks, migration review | PENDING |
| SEC-001 | Yes | `RequireAuthorization` on the group, owner filter on every query, cross-user IDs return 404, CSRF via existing client, all input validated server-side, request body capped at 32 KB on POST/PUT (`RequestSizeLimit` metadata plus `MortgageRequestLimit` middleware, which rejects with 413 before the body is bound and also bounds bodies with no declared length, which the attribute alone does not enforce under the test server), then ≤ 60 rows and name ≤ 100 validated. | Independent security review | PENDING |
| SEC-002 | No | No configuration, credentials or integrations change. | — | N/A |
| SEC-003 | Yes | Loan amounts and rates are financial data: never logged, never in audit text or error details; load failure shows generic text (FR-024); 500s return the existing generic ProblemDetails. | Security review | PENDING |
| WEB-001 | Yes | TypeScript strict, Zod response schemas, typed ProblemDetails cases (400 field errors, 401, 404, 409), shadcn/Base UI primitives, tokens only, WCAG 2.2 AA (mortgage strip as a `nav` list of buttons with `aria-current`, not ARIA tabs, so delete buttons are valid; live regions, chart text alternative). | Frontend gates, UI compliance checklist | PENDING |
| Perf & Observability | Yes | Save, Delete and Reload buttons show busy state immediately (< 500 ms; "Saving…", "Deleting…", "Reloading…"); loading spinner (FR-023); Retry swaps to the spinner at once; `Clutch.API.Mortgages` meter registered in `Program.cs`. | 500 ms feedback, OpenTelemetry metrics | PENDING |

**Applicable style guide sections**: §2 Layout (content panel, bottom-panel styling for Loan
details like `AddCategoryForm`), §3 Navigation (new item, unchanged behaviour), §4 Forms (floating
labels for every field incl. date and select), §5 Components (buttons, dialog, charts; tab strip and toast rules added by T075),
§6 Tokens (chart series `primary`, schedule table surfaces), §7 Typography, §8 Motion (spinner and
toast honour `prefers-reduced-motion`), §9 Accessibility.

**UI compliance checklist** (style guide §11):

- [ ] No borders or divider lines on layout containers (documented hairline exception only)
- [ ] Surface hierarchy follows canvas, content, card, raised
- [ ] Only tokens used: no raw hex, no default palette, no non-token radius
- [ ] Form fields use floating labels
- [ ] Navigation expand/collapse behaviour unchanged; only restyled, unless an approved spec amends it (015: content resizes at 768px and above)
- [ ] Dark theme has no pure black surface or pure white text
- [ ] Both themes visually verified
- [ ] WCAG 2.2 AA contrast checked in both themes
- [ ] Visible focus ring on every interactive element
- [ ] Status not conveyed by colour alone
- [ ] `prefers-reduced-motion` respected

**Post-design re-check (Phase 1)**: No violations. Design adds no dependency, keeps calculation
out of scope, and every PENDING gate maps to a task in `/speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/016-mortgage-tracking/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mortgages-api.md
│   └── mortgages-ui.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/Clutch.API/
├── Domain/Mortgages/Mortgage.cs                      # new: aggregate, version, rate changes
├── Domain/Mortgages/InterestRateChange.cs            # new
├── Domain/Mortgages/RepaymentFrequency.cs            # new: Weekly | Fortnightly | Monthly
├── Domain/Mortgages/RepaymentDates.cs                # new: final repayment date (FR-019)
├── Domain/Mortgages/MortgageValidator.cs             # new: FR-007 rules → field errors
├── Application/Mortgages/MortgageService.cs          # new: list/create/update/delete + audit
├── Application/Mortgages/MortgageMetrics.cs          # new
├── Api/Endpoints/MortgageEndpoints.cs                # new: loose request DTO → decimal?/string? (contract)
├── Infrastructure/DependencyInjection.cs             # changed: register MortgageService
├── Infrastructure/Persistence/AppDbContext.cs        # changed: mapping, indexes
├── Infrastructure/Persistence/Migrations/*_Mortgages.cs  # new
└── Program.cs                                        # changed: meter, MapMortgageEndpoints

tests/Clutch.API.Tests/
├── Unit/Mortgages/                                   # new: RepaymentDates, Mortgage, MortgageValidator, MortgageMetrics
├── Integration/Mortgages/                            # new: endpoints, ownership, 409, limits, audit, logging
└── Integration/Persistence/MortgagesMigrationTests.cs  # new: migration up/down

.claude/skills/clutch-ui-style/references/forms-components.md  # changed: tab strip and toast rules (§5)
.github/                                              # changed: synced copy via scripts/sync-agent-config.ps1

src/clutch-web/
├── src/App.tsx                                       # changed: Mortgages nav item, guard wiring
├── src/components/ui/side-nav.tsx                    # changed: Mortgages item above Categories
├── src/components/ui/toast.tsx                       # new: Base UI Toast primitive (+ test)
├── src/components/unsaved-changes/                   # new: UnsavedChangesProvider (guard context,
│                                                     #      beforeunload) + DiscardChangesDialog (+ tests)
├── src/lib/api/schemas.ts                            # changed: Mortgage schemas
├── src/features/mortgages/                           # new: MortgagesPage, MortgageTabs, LoanDetailsForm,
│                                                     #      InterestRateChangesField, AmortizationSchedule,
│                                                     #      BurnDownChart, DeleteMortgageDialog,
│                                                     #      SessionExpiredDialog,
│                                                     #      repaymentDates.ts, api.ts, *.test.tsx
├── playwright.ownership.config.ts                    # changed: add mortgages.spec.ts to testMatch
└── e2e/mortgages.spec.ts                             # new; style-guide.spec.ts changed (Mortgages states)
```

**Structure Decision**: Existing layout, following the Categories siblings (`CategoryNode*` in the
API, `features/categories/` and `AddCategoryForm` panel in the web app). The unsaved-changes guard
and its discard dialog live in `src/components/unsaved-changes/` (like `components/theme/`) because
App navigation and sign-out use them, not only the feature.

## Complexity Tracking

No constitution violations to justify.
