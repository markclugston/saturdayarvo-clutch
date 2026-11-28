# Validation: Exclude Pending Authorisations From Imports

Run on 2026-11-28.

## Quality gates (ENG-001, DOT-001)

| Command | Result |
|---|---|
| `dotnet build saturdayarvo-clutch.slnx` | Pass, 0 warnings, 0 errors |
| `dotnet test tests/Clutch.API.Tests` (all, including SQL Server; covers the quickstart `Imports` filter) | Pass, 654 of 654 |
| `dotnet list saturdayarvo-clutch.slnx package --vulnerable --include-transitive` | Pass, no vulnerable packages |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass, 1084 of 1084 |
| `npm run build` | Pass (Vite reports a chunk larger than 500 kB) |
| `npm audit --omit=dev` | Pass, 0 vulnerabilities |
| `npm run test:e2e:style-guide` | Pass, 556 of 556 |
| Integration journeys `accounts-import`, `import-settings`, `active-import`, `admin-import-limits` | Pass (see note) |

Notes:

- Integration journeys: the first run passed 11 of 12. The failure was a new assertion in
  `accounts-import.spec.ts` that also matched the delete-button cells; after the fix, the
  `accounts-import` run passed 5 of 5. The other specs did not change afterwards.
- A targeted style-guide run had one failure (`import-review card stops with a margin`, Dark,
  1024). It passed 24 of 24 repeated runs and in the later full run.
- Mocked-API journeys (`playwright.config.ts`) were not run: none covers import.

## Change during implementation

The user replaced the single "AUTHORISATION ONLY" check with a list of authorisation patterns
(spec FR-002, data-model.md). `spec.md`, `data-model.md` and `tasks.md` T010 were updated.

## Differences from the plan

- `ImportOrdering.cs` gained `InferDirectionFromBalances`, extracted unchanged from
  `InferDirection`, because research R1 needs to know when balances alone decide the direction.
- `ImportReview.cs` is unchanged: `ImportReviewRow` never marks an excluded row as a duplicate, so
  the existing duplicate rules already meet data-model.md.
- `AppDbContext.cs` is unchanged: `IsExcluded` maps by convention (see query review).
- `importedCount` in `schemas.ts` now accepts 0, as contracts/import-review.md requires.

## Query review (DOT-002)

| Check | Outcome |
|---|---|
| Query shape | Existing-transaction queries at review creation and confirm keep their projection and filters. Review rows load through the existing `Include`, now with `IsExcluded`. Exclusion runs in memory over rows already loaded. |
| Generated SQL | Captured from an integration test. Finding: a model default on `IsExcluded` split the review-row insert into separate statements with `OUTPUT INSERTED.[IsExcluded]`. Fixed by leaving the default to the migration; the insert is again one multi-row `INSERT`. |
| Indexing | No new filter or sort; no index needed. |
| Round trips | None added. |
| Performance | The rule is linear apart from the existing ordering sorts, within the row limit. |
| Audit rows | No audit row is updated or deleted. |

## Migration review (OPS-001)

`20261128024833_ExcludePendingAuthorisations`:
`ALTER TABLE [ImportReviewRows] ADD [IsExcluded] bit NOT NULL DEFAULT CAST(0 AS bit)`.

- Data loss: none; one added column. `has-pending-model-changes` reports none.
- Backfill: none. Existing review rows default to included and expire within 5 minutes.
- Deployment: apply the migration, then the API, then the web app. The new web app rejects a
  review response from the old API.
- Rollback: the previous API ignores the flag, so it would import excluded rows from a review
  still open. Stop new imports and wait 5 minutes (or cancel open reviews), deploy the previous
  API and web app, then run the `Down` migration, which drops the default and the column.
- Audit table: untouched.

## Security review (SEC-001, SEC-003, SEC-004)

Separate pass over the full diff. No findings.

| Area | Outcome |
|---|---|
| Access control, authentication, CSRF | No new or changed endpoint; review and confirm keep their owner-scoped queries. |
| Input validation | No new input. The server derives the flag; the client cannot send it. The web app validates the new response fields with zod. |
| Injection and denial of service | No raw SQL. The expression has no nested or unbounded repetition and runs on descriptions the parser limits to 200 characters, within the row limit. |
| Sensitive data | No new logs or error details. |
| Secrets | None added. |
| Dependencies and third-party UI | None added; both scans are clean. |
| Integrity and audit | A confirm that saves nothing still writes `ImportConfirmed` and releases the lease. |

## UI compliance checklist (WEB-001)

| Item | Result | Evidence |
|---|---|---|
| Only tokens used | Pass | Lint |
| No borders or divider lines on layout containers | Pass | Lint; no layout change |
| Transitions and reduced motion | Pass | None added; lint, style-guide run |
| Surface hierarchy | Pass | Unchanged; style-guide run |
| Existing primitives and variants | Pass | `StatusChip` `warning`, not restyled |
| Floating labels | Not applicable | No field added or changed |
| Title Case and sentence case | Pass | "Will Not Be Imported"; sentence text unchanged apart from the count |
| % and $ fields | Not applicable | No entry field |
| Numbers right aligned | Pass | Columns unchanged; lint, component tests |
| Navigation behaviour | Pass | Unchanged; style-guide run |
| Dark theme has no pure black or white | Pass | Style-guide run |
| Both themes verified | Pass | Four `import-review` screenshots updated; Light 1024 and Dark 1440 inspected |
| WCAG 2.2 AA and contrast | Pass | `import-review` axe checks in both themes |
| Visible focus ring | Pass | No new control; style-guide run |
| Status not by colour alone | Pass | Chip carries visible text |
| List structure matches Assets | Pass | Unchanged; the chip sits in the Warning column |
| List scrolling | Pass | Unchanged; pinned-list browser tests |
| List actions, confirmation and states | Not applicable | The review list has no row actions; states unchanged |
| List differences approved | Pass | No difference introduced |

## Convergence fixes (T025, T026)

Run on 2026-11-28, after the results above.

- T025: the duplicate banner and checkbox no longer say every valid row or the flagged rows will
  be imported. The component tests were changed first and failed (3 of 46) before the rewording.
- T026: restored the space in `ImportReviewRowSchema`.

| Command | Result |
|---|---|
| `npm run lint` | Pass |
| `npm test` | Pass, 1084 of 1084 |
| `npm run build` (includes the TypeScript compiler) | Pass (same chunk size warning) |
| `npm run test:e2e:style-guide` | Pass, 556 of 556 (screenshot comparisons off by default) |
| Style-guide `import-review` states with `STYLE_SCREENSHOTS=1` | Four `import-review` screenshots regenerated; then 44 of 44 pass. Dark 1440 inspected |
| Integration journey `accounts-import` | Pass, 5 of 5 |

- No C#, schema or dependency change, so the .NET gates, dependency scans and query and migration
  reviews were not rerun. The security outcome is unaffected: static text and spacing only.
- UI checklist: results unchanged. Title Case and sentence case rechecked: the new text is sentence
  case.

## Convergence verification (T027)

Run on 2026-11-28. The second convergence run found no recorded run of two integration journeys
that review and confirm imports.

| Command | Result |
|---|---|
| `npm run test:e2e:integration -- mortgages.spec.ts accounts-transaction-delete.spec.ts` | Pass, 20 of 20 |

No fix was needed and no code changed.

## Correction from user testing (T028 to T030)

Run on 2026-11-28, after the results above.

A real bank file listed a pending authorisation among later dated rows, and it was not excluded
because rows were ordered by date before comparing balances. `ImportExclusions` now compares each
row with the prior row in the file's running order. `spec.md` and research R1 were updated.

| Command | Result |
|---|---|
| New test, before the fix | Failed in both file directions, as expected |
| `dotnet build saturdayarvo-clutch.slnx` | Pass, 0 warnings, 0 errors |
| `dotnet test tests/Clutch.API.Tests` (all, including SQL Server) | Pass, 656 of 656 |

- Build output went to a temporary folder (`-p:OutDir`) because a running debug session locked the
  default one.
- Not rerun: web gates (no web change), the dependency scan (no dependency change), and the query,
  migration and security reviews. The change reorders an in-memory comparison and adds no query,
  schema, input, log or error detail.
- `/speckit-converge` was run afterwards; see Convergence verification (T031).

## Convergence verification (T031)

Run on 2026-11-28, after T029. The third convergence run, run after the correction above, found
that the integration journeys confirming a file with balances had last run before T029. It added
only T031.

| Command | Result |
|---|---|
| `npm run test:e2e:integration -- mortgages.spec.ts import-settings.spec.ts` | Pass, 9 of 9 |

No fix was needed and no code changed.

## Constitution completion review

- Applicable IDs and Constitution Check: plan.md; no deviations.
- ARC-001: `ImportExclusions` is pure domain code; only requested behaviour was built.
- Performance and observability: the confirm timing test passed in the full run;
  `ImportedCount` metrics now count saved rows only.
- Convergence: the second `/speckit-converge` run added only T027 and the third only T031; both are
  complete.
