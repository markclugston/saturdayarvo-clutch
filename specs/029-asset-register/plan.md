# Implementation Plan: Asset Register

**Branch**: `029-asset-register` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

## Summary

Add an owner-scoped Asset register: a list page with each asset's latest valuation in the asset's own currency and server-computed totals per currency (research R9), and an Asset page with its own URL for adding and editing assets with valuations. All edits are saved in one transaction. Editing an existing asset takes a 5-minute edit lease that mirrors the account import lease: one active edit, End Other Edit, an ended-elsewhere notice and expiry. Mortgages are the CRUD pattern; imports (`specs/012-validate-active-import`) are the coordination pattern.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**:
- Schema: new tables `Assets` (with a supported-currency `CurrencyCode`, research R9), `AssetValuations` and `AssetEdits`, and `Audit.Description` widened from `nvarchar(500)` to `nvarchar(max)` (research R2), all in one migration.
- API: `/api/assets` list, create, save and delete (no GET by id: an edit's asset detail comes back in the acquire response); edit lease endpoints (acquire, status, end other, release). See [contracts/assets-api.md](./contracts/assets-api.md).
- Application: `AssetService` (CRUD and audit), `AssetEditService` (lease), `AssetMetrics` meter.
- UI: `features/assets/` (list, Asset page, valuation dialog, edit-ended dialog, status hook, `assetRoute.ts` History API module); Assets nav item; a persistent-toast stack in `components/ui/toast.tsx`; an optional `decimals` prop on `FormattedNumberField` (default 2) for currencies such as JPY (research R9). See [contracts/assets-ui.md](./contracts/assets-ui.md).
- No new packages.

**Performance Goals**: List of 100 assets shown within 2 s (SC-002) in one query. The server query time is measured against real SQL Server (SqlServer test); the client render time from selecting Assets is measured in the mocked-API browser test. Together they cover SC-002; no real-API 100-asset browser run is added. Ended or freed edit detected within 5 s (status poll every 2 s, request bound 2 s, as imports do).

**Constraints**: One active edit per asset. Save, End and Release are mutually exclusive through conditional updates in one transaction. Audit description length is unbounded (`nvarchar(max)`, research R2). Owner-only access, and inaccessible assets return 404.

**Scale/Scope**: Single user per asset; no limits on asset or valuation counts beyond the 64 KB request limit.

## Constitution Check

*Procedure: `clutch-constitution-check`. Pre-research: PASS for planning. Post-design: PASS for planning. Every PENDING gate needs a task in tasks.md.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | Validation and lease transitions in `Domain/Assets`; EF and transactions in `Application/Assets`; routes only map outcomes; UI only in clutch-web. No router, no extra preference (R1, R8). | Review | PASS |
| DOT-001 | Yes | .NET 10, async with `CancellationToken`, typed outcomes mapped to ProblemDetails, following `MortgageService` and `ImportStateService`. | Build, tests | PENDING |
| DOT-002 | Yes | EF Core only: no-tracking list projection (R6), conditional `ExecuteUpdate` for the lease (R3), unique `(AssetId, ValuationDate)`. Docker SQL Server tests for save/end/acquire races, expiry, cascade delete and the list query. | Independent query review; `Category=SqlServer` tests | PENDING |
| AUD-001 | Yes | Asset events appended to `Audit` only, one row per operation, inside the same transaction (R2). `Description` widened to `nvarchar(max)`: existing row contents are unchanged, the non-blank check constraint is dropped and recreated around the `ALTER COLUMN` (R2) so it stays, and the update/delete guards are unchanged. No new audit table. | Audit append-only check; audit integration tests including a description longer than 500 characters | PENDING |
| ENG-001 | Yes | Unit (validator, valuation-set diff, audit text, lease transitions), HTTP, SQL Server, component and Playwright (mocked list/add/edit/delete; real-API two-session lease journey) tests. | Test tasks; quality gates | PENDING |
| OPS-001 | Yes | Structured logs with ids only (no names, descriptions or values). `AssetMetrics` meter registered in `Program.cs`. Existing DB health check covers the new tables. Migration adds three tables and widens `Audit.Description`. Rollback: Down drops the three new tables and leaves `Audit.Description` wide, because narrowing it would truncate or reject audit rows (R2). | Logging review; migration review | PENDING |
| SEC-001 | Yes | `RequireAuthorization` group, owner filter on every query, CSRF on mutations, 404 for foreign assets and edits, request size limit, server validation of every field. | Independent OWASP review | PENDING |
| SEC-002 | Yes (marginal) | No secrets or configuration added; real-API test users use the existing ephemeral provisioning. | Security review | PENDING |
| SEC-003 | Yes | Asset values are financial data: never logged or in metrics tags. Errors are ProblemDetails with field codes only. Ended-by username disclosed only to the owner, rendered as text. | Security review | PENDING |
| SEC-004 | Yes | Every FR-007/008/009 rule, including currency and its decimal places, in the Zod and form validation and again in `AssetValidator` before any DB work, each tested in both places. 400 ProblemDetails `errors` keyed by field (`name`, `description`, `currencyCode`, `valuations[i].value`, `valuations[i].valuationDate`, `valuations`). No internal details in messages. | Component and HTTP validation tests; security review | PENDING |
| WEB-001 | Yes | TypeScript, `FormattedNumberField` for Value with `decimals` from the asset currency so a JPY field never shows a decimal point (R9), the accounts currency select, `formatCurrencyAmount` with the asset's currency code for display, right-aligned amounts and total, Title Case, existing Dialog, Button and Card primitives, plus a persistent-toast variant built in the toast primitive (R5). | Lint, component, browser and style-guide tests; UI checklist | PENDING |
| Perf & Observability | Yes | Pending states within 500 ms on loading the list, opening an existing asset (acquire), Save, Delete and End Other Edit; OK is client-only and immediate. Metrics: save, delete, acquire, end and status counters and durations, tagged by operation and outcome only. | Component tests; metrics tests | PENDING |

### Style guide sections (WEB-001)

- §2–3 layout and navigation: content panel, list card, the new nav item below Accounts with no change to expand/collapse.
- §4–5 forms and components: floating-label fields (including the currency select), the formatted currency field (new `decimals` prop), buttons, Dialog, toast (persistent variant), trash icon button, per-currency total rows.
- §6 tokens: status for blocked and ended states uses token text and an icon, not colour alone.
- §7–9 typography, motion and accessibility: Title Case labels; toast motion respects reduced motion; dialog focus trap; a blocking ended notice that has no Escape dismissal.
- §10 primitive change: `toast.tsx` gains the persistent stack (regular toasts above it). The code changes first, then the toast tests and the style-guide toast-layout browser state, then the `clutch-ui-style` toast guidance (`references/forms-components.md`), mirrored to `.github/` with `sync-agent-config.ps1`.
- §11 checklist below.

### UI compliance checklist (§11)

| Item | Check |
|---|---|
| [ ] Only tokens used: no raw colours, default palette, non-token radius, extra ring or shadow, or `dark:` colour | Lint |
| [ ] No borders or divider lines on layout containers (hairline utilities only) | Lint, Review |
| [ ] Transitions, durations and easing within the allowed set; `prefers-reduced-motion` respected | Lint, Browser |
| [ ] Surface hierarchy follows canvas, content, card, raised | Browser, Review |
| [ ] Built from existing primitives and variants; none restyled ad hoc | Review |
| [ ] Form fields use floating labels | Review |
| [ ] Labels, headings and button text use Title Case; helper, error and body text use sentence case | Review |
| [ ] % and $ fields use the shared formatted field (invalid characters never displayed, formatted on blur) | Component |
| [ ] Numbers and currency amounts, and their column headers, are right aligned (`text-right`, `tabular-nums`) | Lint, Component, Review |
| [ ] Navigation expand/collapse behaviour unchanged unless an approved spec amends it | Browser |
| [ ] Dark theme has no pure black surface or pure white text | Browser |
| [ ] Both themes verified (screenshots) | Browser |
| [ ] WCAG 2.2 AA (axe) and contrast pass in both themes | Browser |
| [ ] Visible focus ring on every interactive element | Browser |
| [ ] Status not conveyed by colour alone | Review |

## Project Structure

### Documentation (this feature)

```text
specs/029-asset-register/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── assets-api.md
│   └── assets-ui.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/Clutch.API/
  Domain/Assets/Asset.cs, AssetValuation.cs, AssetEdit.cs, AssetValidator.cs, AssetAuditText.cs,
                AssetValuationDiff.cs                                                             (new)
  Domain/Audit/Audit.cs                                                                           (remove 500-character limit)
  Application/Assets/AssetService.cs, AssetEditService.cs, AssetMetrics.cs                        (new)
  Api/Endpoints/AssetEndpoints.cs                                                                 (new)
  Infrastructure/Persistence/AppDbContext.cs, Migrations/<ts>_AddAssets.cs                        (changed / new)
  Infrastructure/DependencyInjection.cs, Program.cs                                               (register services, meter, endpoints)
tests/Clutch.API.Tests/
  Unit/Assets/                    (validator, audit text, edit transitions, diff)
  Unit/Audit/                     (update: long description accepted, blank still rejected)
  Integration/Assets/             (HTTP, SqlServer: CRUD, list query, lease races, expiry, audit, logging)
  Integration/Persistence/AssetsMigrationTests.cs  (new: tables, indexes, constraints, Audit.Description widening)
src/clutch-web/
  src/App.tsx                     (Assets nav item below Accounts, page state, URL sync)
  src/components/ui/toast.tsx(+test)  (persistent stack, showPersistent)
  src/features/mortgages/FormattedNumberField.tsx(+test)  (optional decimals prop, default 2)
  src/lib/api/schemas.ts(+test)   (asset and edit-status schemas)
  src/features/assets/            (new) api.ts, assetRoute.ts, AssetsPage.tsx, AssetPage.tsx,
                                  AddValuationDialog.tsx, DeleteAssetDialog.tsx, AssetEditEndedDialog.tsx,
                                  useAssetEditStatus.ts, assetDraft.ts, *.test.ts(x)
  e2e/assets.spec.ts              (mocked API journeys)
  e2e/asset-edit-lease.spec.ts    (real API, two sessions)
  e2e/style-guide.spec.ts         (persistent toast state)
```

**Structure Decision**: Existing layout, following sibling files (mortgages for CRUD, imports for coordination). The one deviation is the History API URL module (research R1), scoped to Assets.

## Complexity Tracking

No constitutional violations.
