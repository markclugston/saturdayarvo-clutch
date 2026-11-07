# Research: Import Bank Transactions

## Decisions

### Application foundation

- **Decision**: Add ASP.NET Core Identity using browser cookies, an EF Core `IdentityDbContext`, and a durable relational database. Use the first-party SQL Server EF Core provider for the initial production provider; use the same provider in database integration tests through a disposable SQL Server container.
- **Rationale**: The repository currently has only a .NET 10 API starter and React/Vite frontend, with no authentication, database, or tests. Microsoft recommends cookies for browser SPAs because the browser handles them without exposing credentials to JavaScript. First-party SQL Server and SQLite providers support EF Core 10; SQL Server is the more appropriate initial provider for concurrent imports across sessions.
- **Alternatives considered**: Browser-stored bearer tokens were rejected because they expose credentials to JavaScript. SQLite is suitable for lightweight local development but its concurrency characteristics are a weaker fit for shared writes. PostgreSQL was not selected because EF Core 10 provider compatibility was not verified during research.
- **Sources**: [Microsoft Identity API authorization for SPAs](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-api-authorization?view=aspnetcore-10.0), [EF Core providers](https://learn.microsoft.com/en-us/ef/core/providers/), [EF Core testing without the database](https://learn.microsoft.com/en-us/ef/core/testing/testing-without-the-database).

### Cookie security and authorization

- **Decision**: Keep the React app and API same-origin, use secure HttpOnly SameSite cookies, and require an antiforgery request token on state-changing JSON API calls. Use server-side authorization for account access and an administrator role for global import-limit settings. Provision the initial administrator through protected deployment/bootstrap configuration, not a public registration path or committed secret.
- **Rationale**: ASP.NET Core's automatic CSRF protection does not by itself reject cross-origin JSON API requests. A separate antiforgery token/header check is needed; cookie authentication alone is insufficient. Family ownership must be evaluated on every Family, account, transaction and import-review request.
- **Alternatives considered**: Relying only on SameSite or automatic form antiforgery checks was rejected for JSON requests. Storing identity tokens in local storage was rejected.
- **Sources**: [ASP.NET Core antiforgery](https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0), [SameSite cookies](https://learn.microsoft.com/en-us/aspnet/core/security/samesite?view=aspnetcore-10.0), [Identity API authorization for SPAs](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-api-authorization?view=aspnetcore-10.0).

### Family ownership and future sharing

- **Decision**: Each user may create one Family in this feature and becomes its owner. All accounts belong to the Family; only its owner can view, edit, or import. Invitations, additional members and access grants are deferred.
- **Rationale**: The owner chose a Family model, requested owner-only support now, and intends a future feature where the owner grants separate view/edit permissions per account and users can join multiple Families without moving existing accounts.
- **Alternatives considered**: The original per-account sharing and equal access-management permissions were superseded. Implementing member management now was rejected as outside the requested scope.
- **Source**: User clarification recorded in `spec.md`.

### CSV import safety and lifecycle

- **Decision**: Parse uploads on the server with a streaming CSV parser, bounded by the configured request-byte limit and 10,000-row default. Treat all cells as untrusted; validate only mapped fields and reject malformed rows, invalid values, and recognized financial identifiers without echoing their contents. Retain no original file after parsing. Keep only normalized, validated mapped rows in a short-lived review session until confirmation, cancellation, or expiry. Commit all transactions atomically.
- **Rationale**: OWASP recommends server-side type/size validation and resource bounds for uploads, length bounds before pattern matching, and treating client checks as UX rather than security. A review must survive multiple HTTP requests without retaining the source file; a short-lived normalized stage supports that requirement while keeping raw and unmapped bank-export fields out of persistence.
- **Alternatives considered**: Keeping the entire upload in memory or permanently storing the original file was rejected due to resource-exhaustion and data-minimization risks. Per-row commits were rejected because they allow partial imports contrary to the spec.
- **Sources**: [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html), [OWASP Denial of Service Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html), [NIST SP 800-122](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-122.pdf).
- **Column mapping UX**: Use PapaParse in the browser to read only the CSV header record from the selected local `File`, so the user can map columns before upload. The browser does not send or retain parsed transaction rows; the API independently parses and validates the entire file with CsvHelper. Client parsing is untrusted UX and never substitutes for server validation.

### Import coordination and duplicate review

- **Decision**: Acquire a database-backed per-account import lease before processing; keep one active review per account, expire abandoned reviews, and re-check against the account's current transactions when committing. Compare exact date, description, amount, and direction as required by the spec; flag matches for explicit confirmation rather than deduplicating.
- **Rationale**: An application-memory lock does not coordinate multiple API instances. Database-backed coordination closes check-then-insert races and keeps the duplicate check scoped to the selected account. The spec intentionally allows legitimate identical transactions.
- **Alternatives considered**: Process-local locks and silent duplicate suppression were rejected because they do not uphold multi-instance concurrency or the required user choice.
- **Sources**: [EF Core transactions](https://learn.microsoft.com/en-us/ef/core/saving/transactions), [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

### Currency and regional formats

- **Decision**: Use ISO 4217 codes as currency identity and CLDR-backed locale data (`Intl.NumberFormat` / `Intl.DateTimeFormat` in the browser) for display. For import parsing, use a version-controlled application registry keyed by currency code; each entry records its expected grouping/decimal separators, whether it has multiple conventions, and its reference/version. Parse strictly against a selected registry convention, require user selection when there are multiple conventions or a value is ambiguous, and do not infer import separators from display locale settings. Parse monetary values into decimal precision, not binary floating point.
- **Rationale**: ISO 4217 identifies currencies and minor units but not number separators. CLDR supplies locale-dependent presentation; native web `Intl` does not provide a number parser. For example, comma grouping and period decimal are an `en-AU` convention, not an invariant of AUD. The explicit registry makes the import default reproducible and reviewable, while user selection handles formats that cannot be determined from currency identity alone.
- **Alternatives considered**: Treating every currency as two-decimal or assuming one separator convention per currency was rejected. Using browser display-formatting APIs to parse input was rejected because no standard `Intl.NumberFormat.parse` exists.
- **Sources**: [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html), [Unicode CLDR](https://cldr.unicode.org/), [Unicode TR35 Numbers](https://www.unicode.org/reports/tr35/tr35-numbers.html), [MDN `Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat).

### Runtime import limits

- **Decision**: Add administrator-managed shared settings persisted in the application database, effective without restart or redeployment. Enforce safe defaults of 10 MiB per file, 10,000 transaction rows, and five import attempts per authenticated user per minute until changed. Independently enforce the byte cap at the HTTP boundary and reject over-limit requests before parsing or persistence.
- **Rationale**: The current app has no limits to inherit. The user clarified that limits must be settable through an administrator UI at runtime and that defaults must remain active until settings are changed.
- **Alternatives considered**: Deployment-only settings and unbounded imports were rejected because they do not meet the clarified runtime administrator requirement.
- **Source**: User clarification recorded in `spec.md`.
- **Rate-limit coordination**: Enforce attempts per authenticated user with shared application state so multiple API instances cannot each grant a separate allowance; persist fixed one-minute UTC window counters through EF Core and expire old windows.

## Cross-cutting constraints

- Do not log, return, or persist rejected identifiers, raw row values from errors, or uploaded file contents. Import audit events record only actor, account, time, and outcome.
- Use typed validation errors and RFC 9457 `ProblemDetails`; predictable input failures are not exceptional control flow.
- Run an independent OWASP Top 10 review and dependency vulnerability check before implementation acceptance. Database changes require integration tests against the production provider and an independent EF-generated SQL/query-shape review.
- **Sensitive-data handling**: The feature rejects specified card-number patterns and must not retain rejected sensitive identifiers or raw CSV content. These application data-minimization and security requirements are independent of any external compliance assessment.
