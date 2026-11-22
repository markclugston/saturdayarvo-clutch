# Implementation Plan: Mortgage Account Balance Column

**Branch**: `020-mortgage-account-balance-column` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

## Summary

A mortgage gets an optional link to one of the user's accounts, chosen in a "Mortgage Account" drop-down in
the Details group. With a link, the Amortization Schedule shows a balance column right of Bank Schedule:
the account balance at each period's end. The API stores the link (nullable FK) and serves period balances
from a new read endpoint that reuses the repayment-date rules; the UI follows the drop-down live, so a new,
unsaved mortgage shows monthly balances from the account's first balance-bearing transaction (research R1, R6).

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**:

- Schema: nullable `Mortgages.AccountId` FK (`SetNull`), index, one migration. See [data-model.md](data-model.md).
- Endpoints: `accountId` on `/api/mortgages` POST/PUT/GET; new `GET /api/mortgages/period-balances`. See
  [contracts/mortgage-account-balance-api.md](contracts/mortgage-account-balance-api.md).
- Domain: `Domain/Mortgages/PeriodBalances.cs` (pure period-end lookup).
- UI: drop-down in `LoanDetailsForm`, optional fourth column in `AmortizationSchedule`. See
  [contracts/mortgage-account-balance-ui.md](contracts/mortgage-account-balance-ui.md).
- Metrics: one counter and duration histogram added to the existing `Clutch.API.Mortgages` meter.
- No new packages. Open decisions resolved in [research.md](research.md).

**Performance Goals**: Balance endpoint responds in under 2 s for a 360-period mortgage and 10,000 transactions (SC-004): one projected query,
in-memory fold, response bounded by history span.

**Constraints**: Balances are read from `Transaction.Balance` only (never calculated); accounts gain no
label (FR-001); the spec's save rules are unchanged (a mortgage still cannot be saved with incomplete Details).

**Scale/Scope**: One new query, one new endpoint, one select, one column.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | Period logic in `Domain/Mortgages` with no HTTP/EF types; query in `Application`; UI in clutch-web. Only spec'd behaviour: no calculations of balances. | Review | PASS |
| DOT-001 | Yes | .NET 10, async with `CancellationToken`; invalid input becomes `ApiProblemException` field errors in the service, as `MortgageService` does today. | Build, tests | PASS |
| DOT-002 | Yes | EF Core only; `AsNoTracking` projection of two columns plus `Min`/`Max`, owner check via `AccountService.GetOwnedAsync`; FK `SetNull`; SQL Server tests for ownership, ordering, account delete and migration. | Independent query review, provider-backed integration tests | PASS |
| AUD-001 | Yes (unchanged) | Existing `MortgageUpdate`/`MortgageCreate` audit rows still written in the same `SaveChanges`; text carries no account or balance data; no audit update/delete. | Audit append-only check, test: one row per save with a link | PASS |
| ENG-001 | Yes | Unit tests (`PeriodBalances`, validator, `Mortgage`), integration tests (endpoints, ownership, migration), Vitest component tests, Playwright journey. | Test tasks, quality gates | PASS |
| OPS-001 | Yes | Structured logs carry mortgage/account ids only; migration reviewed (additive, nullable, rollback drops column); existing health check covers the table. | Logging, health checks, migration review | PASS |
| SEC-001 | Yes | `RequireAuthorization`; account ownership enforced on save (400) and on balances (404, foreign ids look identical to unknown); query params validated server-side; no request body added to the 32 KB limit path. | Independent security review | PASS |
| SEC-002 | No | No configuration or secrets. | N/A | N/A |
| SEC-003 | Yes | Balances are financial data: returned only to the owner, never logged or put in audit text or errors; load failure shows a generic message. | Security review | PASS |
| WEB-001 | Yes | TypeScript, Zod schemas, existing `FloatingField` select and schedule primitives, tokens only, `aria` roles kept on the table, status for loading and failure. | Frontend gates, UI compliance checklist | PASS |
| Perf & Observability | Yes | Account change shows a loading state at once (< 500 ms feedback); meter metric for the endpoint. | 500 ms feedback, OpenTelemetry metrics | PASS |

**Applicable style guide sections**: §2 Layout (schedule inside the card), §4 Forms (floating select), §5
Components (select, table), §6 Tokens (surfaces, `text-fg-secondary`), §7 Typography (Title Case labels),
§9 Accessibility (table roles, status messages).

**UI compliance checklist** (style guide §11):

- [x] Only tokens used: no raw colours, default palette, non-token radius, extra ring or shadow, or `dark:` colour
- [x] No borders or divider lines on layout containers (hairline utilities only)
- [x] Transitions, durations and easing within the allowed set; `prefers-reduced-motion` respected
- [x] Surface hierarchy follows canvas, content, card, raised
- [x] Built from existing primitives and variants; none restyled ad hoc
- [x] Form fields use floating labels
- [x] Labels, headings and button text use Title Case; helper, error and body text use sentence case
- [x] % and $ fields use the shared formatted field (not applicable: no new entry field; balances are read-only)
- [x] Navigation expand/collapse behaviour unchanged unless an approved spec amends it
- [x] Dark theme has no pure black surface or pure white text
- [x] Both themes verified (screenshots)
- [x] WCAG 2.2 AA (axe) and contrast pass in both themes
- [x] Visible focus ring on every interactive element
- [x] Status not conveyed by colour alone

**Post-design re-check (Phase 1)**: No violations. No dependency added; every PENDING gate maps to a task
in `/speckit-tasks`. Spec US3 and FR-008 only arise for unsaved mortgages (research R1); this is now recorded
in the spec's Assumptions, not a constitutional issue. SC-004 is covered by a timed test (T017), and
structured logging with a no-financial-data test by T021/T017 (OPS-001, SEC-003).

## Project Structure

### Documentation (this feature)

```text
specs/020-mortgage-account-balance-column/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mortgage-account-balance-api.md
│   └── mortgage-account-balance-ui.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/Clutch.API/
├── Domain/Mortgages/Mortgage.cs                     # changed: AccountId; Create/Update
├── Domain/Mortgages/MortgageValidator.cs            # changed: candidate AccountId parsing
├── Domain/Mortgages/PeriodBalances.cs               # new: period-end balance lookup
├── Application/Mortgages/MortgageService.cs         # changed: ownership check, pass AccountId
├── Application/Mortgages/PeriodBalanceService.cs    # new: query + fold, fallback periods
├── Application/Mortgages/MortgageMetrics.cs         # changed: balance-read metric
├── Api/Endpoints/MortgageEndpoints.cs               # changed: accountId, period-balances route
├── Infrastructure/DependencyInjection.cs            # changed: register PeriodBalanceService
├── Infrastructure/Persistence/AppDbContext.cs       # changed: FK, index
└── Infrastructure/Persistence/Migrations/*_MortgageAccountLink.cs   # new

tests/Clutch.API.Tests/
├── Unit/Mortgages/                                  # changed/new: PeriodBalances, Mortgage, validator
├── Integration/Mortgages/                           # changed/new: link, balances endpoint, ownership
└── Integration/Persistence/                         # new: migration up/down

src/clutch-web/
├── src/lib/api/schemas.ts                           # changed: accountId, period balances schema
├── src/features/mortgages/api.ts                    # changed: getPeriodBalances, usePeriodBalances
├── src/features/mortgages/loanDraft.ts              # changed: accountId in draft
├── src/features/mortgages/LoanDetailsForm.tsx       # changed: Mortgage Account select, onAccountChange
├── src/features/mortgages/MortgagesPage.tsx         # changed: hold live accountId
├── src/features/mortgages/LoanPayoffTimeline.tsx    # changed: pass props
├── src/features/mortgages/AmortizationSchedule.tsx  # changed: balance column, fallback rows
├── src/features/accounts/useTransactions.ts         # changed: invalidate balances on delete
├── src/features/imports/ImportPage.tsx              # changed: invalidate balances after import
├── src/features/mortgages/*.test.tsx|ts             # changed/new tests
├── src/features/imports/ImportPage.test.tsx         # changed: balances invalidated after import (FR-011)
├── src/features/accounts/useTransactions.test.ts    # changed: balances invalidated on delete (FR-011)
└── e2e/mortgages.spec.ts                            # changed: link journey
```

**Structure Decision**: Existing layout, following the 016 mortgage siblings. The balance endpoint lives
under `/api/mortgages` (not the accounts group) so the feature's API and metrics stay in one area.

## Complexity Tracking

No constitution violations to justify.
