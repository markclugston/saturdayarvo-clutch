# Completion Reviews: Remember Navigation Expanded State

Date: 2026-11-22. Covers T025 (query review), T026 (migration review) and T027 (OWASP Top 10 and
dependency review) over the whole 018 diff: `NavigationPreferenceEndpoints.cs`,
`NavigationPreferenceService.cs`, `PreferenceMetrics.cs`, `UserNavigationPreference.cs`,
`AppDbContext.cs` mapping, the `AddNavigationPreferences` migration, `Program.cs` and
`DependencyInjection.cs` registration, and the clutch-web preference hooks and `App.tsx` changes.

**Reviewer independence**: each review was a separate pass after the code was written, run by the
same agent that implemented the feature (not an outside reviewer). The pass produced real findings
(F1 below), but a human or separate-agent review would be stricter.

## T025 Independent query review (DOT-002)

| Check | Outcome |
|---|---|
| Query shape (projection, filtering, includes, client evaluation) | Pass. Read: `AsNoTracking`, filter on the primary key, projects only `State`, no includes, no client evaluation. Save: one tracked lookup by primary key, then one `SaveChanges`. |
| Generated SQL | Pass, with a limit: SQL was derived from the query shape (single-row primary-key lookup and an insert or update), not captured from a live trace. The provider-backed integration tests exercise both paths against SQL Server. |
| Indexing impact | Pass. Every query filters on `UserId`, the primary key. No extra index needed. |
| Avoidable round trips | Pass. No per-row lookups; the upsert is one read plus one write inside one transaction. |
| Performance bottlenecks | Pass. One row per user. The upsert uses a serializable transaction through the execution strategy. A new test sends 12 saves at once from two devices of one user: all succeed and both devices read the same final state. |
| No audit row updated or deleted | Pass. The feature never touches the `Audit` table (AUD-001 not applicable). |

Observation (not blocking): a client that aborts a save is counted under the `failure` outcome, because
cancellation skips the `success` assignment. This only skews the metric slightly and is left as is.

## T026 Migration review (OPS-001, DOT-002)

Script reviewed with `dotnet ef migrations script 20261120231959_Mortgages 20261121064318_AddNavigationPreferences`.

| Check | Outcome |
|---|---|
| Data-loss risk | Pass. Creates one new table with its primary key, foreign key (cascade delete to `AspNetUsers`) and check constraint. No drops, no type narrowing, no change to existing tables or data. |
| Rollback or backfill | Pass. `Down` drops the table; the preference is a convenience, so losing rows only returns users to the compact default. No backfill: users with no row read `Unpinned`. |
| Audit table append-only | Pass. Not touched. |
| Applies cleanly | Pass. The SQL Server integration fixture applies all migrations, and a test checks the table and constraint exist. |

## T027 Independent OWASP Top 10 and dependency review (SEC-001, SEC-003)

| Area | Outcome |
|---|---|
| A01 Broken access control | Pass. Both operations use `RequireAuthorization`. The user ID comes only from the principal; no ID is accepted from the client. Tests: signed-out `GET` and `PUT` return 401, and one user never reads another's state. |
| A02 Cryptographic failures | Not applicable. Nothing sensitive is stored. |
| A03 Injection | Pass. EF Core parameterises every query and no raw SQL is in production code. `state` is allow-listed to `Pinned` or `Unpinned` in the endpoint and again by a database check constraint. |
| A04 Insecure design | Accepted. There is no per-user rate limit on saves, the same as the theme preference. Writes are one tiny row per authenticated user. |
| A05 Security misconfiguration | Pass after F1. Security headers, HTTPS and HSTS are the existing global setup. Errors are generic ProblemDetails with no internal detail. |
| A06 Vulnerable components | Pass. No packages added or changed. `dotnet list package --vulnerable --include-transitive` and `npm audit --omit=dev` report none. |
| A07 Authentication failures | Not applicable. No authentication changes. |
| A08 Integrity failures | Pass. The existing global anti-forgery check covers `PUT`; a new test confirms a save without a token is rejected and saves nothing. |
| A09 Logging and monitoring | Pass. Save failures are logged by message template without request body or user ID. Save outcomes and duration are metered. |
| A10 SSRF | Not applicable. |
| Input validation | Pass after F1. Validated on the server; the client's Zod schema checks the response. |
| Secrets (SEC-002) | Pass. None added to source, configuration or tests. |
| Sensitive data (SEC-003) | Pass. Pinned or unpinned is not personal data. No sensitive data in logs or errors. |
| Browser storage | Pass. The state is not kept in `localStorage` or `sessionStorage`, and no `dangerouslySetInnerHTML` is used. |
| Third-party UI code | Not applicable. No new UI dependencies. |

### Findings

| ID | Severity | Location | Finding | Remediation | Verified |
|---|---|---|---|---|---|
| F1 | Medium | `NavigationPreferenceEndpoints.cs` | Since T031 the save endpoint read the whole request body into memory and parsed it. The server's default body limit is about 30 MB, so a signed-in user could make it buffer a very large body to set a one-word value. | The endpoint reads at most 1 KB and treats a larger body as invalid (the contract's 400, nothing saved). | New test `Oversized_body_is_rejected_as_invalid_and_saves_nothing`; all 19 navigation preference tests pass. |

No other findings. All findings are remediated and verified.

## Gate evidence

- `dotnet test … --filter NavigationPreference`: 19/19 pass.
- `dotnet list package --vulnerable --include-transitive`: no vulnerable packages.
- `npm audit --omit=dev`: 0 vulnerabilities.
