# Implementation Plan: Exclude Pending Authorisations From Imports

**Branch**: `032-exclude-pending-authorisations` | **Date**: 2026-11-28 | **Spec**: [spec.md](spec.md)

## Summary

When a review is created, a new pure domain rule marks each review row as excluded (FR-001..FR-003) and stores the flag on the row. Excluded rows are never possible duplicates, are skipped on confirm, and come back in the preview with a "Will Not Be Imported" chip in the existing Warning column; the preview sentence counts only included rows. How the chronologically prior row is found when authorisations break balance reconciliation is decided in [research.md](research.md) R1.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**:

- Domain: new pure rule `ImportExclusions` beside `ImportOrdering`; `ImportReviewRow` gains `IsExcluded` ([data-model.md](data-model.md)).
- Schema: one column on `ImportReviewRows`, one migration ([data-model.md](data-model.md)).
- API: review response gains `importRowCount` and per-row `isExcluded`; confirm accepts a review whose rows are all excluded ([contracts/import-review.md](contracts/import-review.md)).
- UI: `ImportReviewTable` chip and count sentence; zod schema ([contracts/import-review.md](contracts/import-review.md)).
- No new endpoints, packages or settings.

**Unknowns**: ~~Which row is "chronologically prior" when authorisation rows make the balance-based file direction (`ImportOrdering.InferDirection`) fail?~~ Resolved in [research.md](research.md) R1.

**Performance Goals**: Constitution defaults.

**Constraints**: Exclusion is decided on the server only (FR-007). Rule is O(n) over parsed rows, within existing row limits.

**Scale/Scope**: Two services, one domain rule, one entity, one migration, one table component.

## Constitution Check

*Procedure: `clutch-constitution-check` skill.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | Exclusion is a pure domain rule independent of HTTP and EF; only the requested behaviour is built; UI stays in clutch-web. | Review | Pass |
| DOT-001 | Yes | Existing .NET 10 projects, no new targets. | Build, tests | Pass |
| DOT-002 | Yes | New column via EF Core; confirm and review-create changes run against SQL Server in integration tests. | Independent query review; provider-backed integration tests in `Integration/Imports/` | Pass |
| ENG-001 | Yes | Unit tests for `ImportExclusions` and `ImportReviewRow`/`ImportReview`; integration tests for review and confirm; component tests for the table. | Test tasks, quality gates | Pass |
| OPS-001 | Yes | Migration adds a non-null column with default `0`; rollback drops it; no backfill (review rows live 5 minutes). No new log events. | Migration review | Pass |
| SEC-001 | Yes | No new endpoint; existing ownership and auth on review and confirm are unchanged. | Independent security review | Pass |
| SEC-003 | Yes | Descriptions and amounts are not logged; exclusion adds no new disclosure. | Security review | Pass |
| SEC-004 | Yes | No new user input: the flag is derived on the server from already-validated parsed rows; the response schema is validated in the UI with zod. | Server and schema tests, security review | Pass |
| WEB-001 | Yes | Reuse `StatusChip` in the existing Warning column; Title Case; list unchanged otherwise. | Lint, component tests, style-guide browser tests, UI compliance checklist | Pass |
| Perf & Observability | Yes | No new user action; existing import metrics record `ImportedCount`, which now excludes skipped rows. | 500 ms feedback, existing metrics | Pass |

N/A: AUD-001 (existing `ImportConfirmed` audit event unchanged, no new audit records), SEC-002 (no secrets).

**Style guide sections**: §4–5 (status chip), §6 (status token choice), §7 (Title Case, assistive text), §9 (accessibility), §12 (list). Gate: every item in `clutch-ui-style/references/compliance-checklist.md`.

**List standard (§12)**: the review list keeps its headers, rows and Warning column; the new indication is a chip in that column, the same pattern as Possible Duplicate. No deviation, so no approval is needed. Add the excluded-row state to the import review style-guide state in `e2e/style-guide.spec.ts`.

## Project Structure

### Documentation (this feature)

```text
specs/032-exclude-pending-authorisations/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/import-review.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/Clutch.API/
├── Domain/Imports/ImportExclusions.cs                 # new: pure rule (FR-001..003, research R1)
├── Domain/Imports/ImportReviewRow.cs                  # IsExcluded
├── Domain/Imports/ImportReview.cs                     # duplicates ignore excluded rows
├── Application/Imports/ImportReviewService.cs         # mark exclusions, response fields
├── Application/Imports/ConfirmImportService.cs        # skip excluded, allow zero imported
├── Infrastructure/Persistence/AppDbContext.cs         # IsExcluded mapping
└── Infrastructure/Persistence/Migrations/<ts>_ExcludePendingAuthorisations.cs
tests/Clutch.API.Tests/
├── Unit/Imports/ImportExclusionsTests.cs              # new
├── Unit/Imports/ImportStateTests.cs                   # review/row invariants
└── Integration/Imports/ImportWorkflowTests.cs         # review + confirm against SQL Server
src/clutch-web/
├── src/lib/api/schemas.ts (+ schemas.test.ts)
├── src/features/imports/ImportReviewTable.tsx (+ .test.tsx)
├── src/features/imports/ImportPage.test.tsx           # count sentence, confirm with exclusions
└── e2e/style-guide.spec.ts                            # excluded-row state
```

**Structure Decision**: Existing layout, following sibling files.

## Complexity Tracking

None.
