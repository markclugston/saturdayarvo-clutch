# Research: Save Account Import Settings

## Decision 1: Reuse the existing import mapping as versioned JSON configuration

- **Decision**: Save the existing `ImportMapping` fields as versioned JSON (column indexes, date/amount formats, amount mode, and applicable direction/sign conventions). Do not save file headers, source rows, descriptions, values, or other CSV content.
- **Rationale**: The current import request already sends this typed mapping as JSON, and the parser validates it against the uploaded file. The mapping is read and replaced as a unit rather than queried by individual fields; a schema version allows the stored representation to be checked when read.
- **Alternatives considered**: A second mapping format would duplicate validation and risk differences between manual and saved imports. Relational columns would make each optional, mode-specific field a separate schema concern despite the mapping only being consumed as a whole. Saving the source file or header names would retain more user-controlled content than required.
- **Repository evidence**: `src/Clutch.API/Application/Imports/ImportMapping.cs`; `src/Clutch.API/Api/Endpoints/ImportEndpoints.cs`; `src/clutch-web/src/features/imports/api.ts`.

## Decision 2: Use the existing account ownership and EF Core persistence patterns

- **Decision**: Add a one-to-one account-scoped settings record with a unique account key and a configuration payload; expose an owner-authorized read through the account import API. Use existing EF Core/SQL Server, asynchronous access, and DI conventions.
- **Rationale**: The API already scopes account queries through the owning Family and uses `AsNoTracking()` for reads. The existing settings service demonstrates EF-backed persisted settings, DI registration, and SQL Server integration coverage. Settings for one account cannot be returned for another.
- **Alternatives considered**: A client-only or browser-storage setting is not durable across devices/sessions and is not authoritative. A singleton settings row would share defaults across accounts, contrary to FR-010.
- **Repository evidence**: `src/Clutch.API/Application/Accounts/AccountService.cs`; `src/Clutch.API/Infrastructure/Persistence/Entities/ImportLimitSettings.cs`; `src/Clutch.API/Application/Imports/ImportLimitSettingsService.cs`; `src/Clutch.API/Api/Endpoints/AdminImportLimitEndpoints.cs`; `tests/Clutch.API.Tests/Integration/Admin/ImportLimitSettingsTests.cs`.

## Decision 3: Snapshot settings on the active review and save defaults after transaction commit

- **Decision**: Capture the exact mapping in a temporary persistence snapshot associated with the active import review. Keep the application/API mapping type out of the domain entity. After the existing confirmation transaction has committed all transactions, perform a separate atomic defaults upsert. If that upsert fails, return a successful import result with an explicit `settingsSaved: false` outcome; preserve any previous defaults.
- **Rationale**: The current review/confirm workflow persists review rows before confirmation and writes all transactions atomically during confirmation. Saving settings in that same transaction would make an optional defaults-write failure roll back the transaction import, contradicting FR-014. A temporary mapping snapshot ensures the saved settings are the ones actually used and lets terminal reviews discard that snapshot.
- **Alternatives considered**: Saving on review creation violates FR-009 for canceled, rejected, or failed imports. Having the browser save settings after confirmation can lose the settings-write outcome if the browser disconnects and is not authoritative.
- **Repository evidence**: `src/Clutch.API/Application/Imports/ImportReviewService.cs`; `src/Clutch.API/Application/Imports/ConfirmImportService.cs`; `src/Clutch.API/Domain/Imports/ImportReview.cs`.

## Decision 4: Guard defaults writes against out-of-order successful imports

- **Decision**: Record an opaque latest-successful-import token on the account in the transaction-confirmation transaction. The post-commit defaults upsert must conditionally apply only when its review token still matches that account token, using a short database transaction for the check and write.
- **Rationale**: FR-003 and FR-008 define one current set from the latest successful import. The existing account import lease ends with the transaction commit, so a later import can finish before an earlier post-commit settings write. The token prevents the delayed earlier write from overwriting newer defaults.
- **Alternatives considered**: Timestamps can collide under a fixed or coarse-resolution clock. An unconditional upsert can allow out-of-order writes. Extending the existing import lease through a second transaction introduces extra cleanup and crash-recovery states.
- **Repository evidence**: `src/Clutch.API/Application/Imports/ConfirmImportService.cs`; `src/Clutch.API/Domain/Accounts/Account.cs`; `src/Clutch.API/Infrastructure/Imports/AccountImportLease.cs`.

## Decision 5: Keep the current authenticated API and system theme behavior

- **Decision**: Add an owner-authorized account settings read that clearly represents no saved mapping, and extend confirmation results with the settings-save outcome. The frontend validates the response with Zod and uses the existing React Query, form, and error patterns. Preserve system light/dark preference with no override or persistence.
- **Rationale**: The API is same-origin and cookie-authenticated, with antiforgery protection for state-changing requests. The existing UI already follows OS color preference. The user confirmed that this feature must preserve that behavior.
- **Alternatives considered**: A standalone settings page or a new theme selector would exceed scope. Returning a successful-looking default when retrieval fails would contradict FR-013.
- **Repository evidence**: `src/Clutch.API/Api/Endpoints/ImportEndpoints.cs`; `src/clutch-web/src/features/imports/ImportPage.tsx`; `src/clutch-web/src/components/theme/ThemeProvider.tsx`; `.specify/memory/constitution.md` (Principle VI).

## Decision 6: Export low-cardinality import outcome metrics through OpenTelemetry

- **Decision**: Instrument confirmation duration and outcome, successful transaction counts and per-import transaction rates, and separate settings-save outcomes/duration. Export the application meter through OTLP using the standard `OTEL_EXPORTER_OTLP_ENDPOINT` configuration.
- **Rationale**: The repository had no existing OpenTelemetry registration or import metrics. The feature's applicable observability requirements need an actual exporter; low-cardinality outcome tags avoid exposing account IDs, mappings, transaction data, or file contents.
- **Alternatives considered**: Adding only `System.Diagnostics.Metrics` instruments would leave them uncollected because the application had no meter provider or exporter. Logging import totals would duplicate sensitive operational data and would not provide duration/rate metrics.
- **Repository evidence**: `.specify/memory/constitution.md` (Principle VIII); `src/Clutch.API/Program.cs`; `src/Clutch.API/Application/Imports/ConfirmImportService.cs`.

## Decision 7: Keep settings reads and guarded upserts to one joined read each

- **Decision**: The independent SQL review flagged possible N+1 reads, ownership-query overhead, and a token-check race. Settings retrieval and the guarded upsert now use explicit EF Core left joins, with SQL Server integration assertions confirming one joined `SELECT` per operation. The upsert remains inside a serializable transaction; SQL Server holds the account key's shared lock until commit, so a later confirmation cannot change the token between the check and write. Keep the existing primary/foreign-key indexes; no additional index is justified for the point lookups.
- **Rationale**: Explicit joins make the one-round-trip query shape verifiable. Serializable isolation protects the token comparison without provider-specific raw SQL or lock hints, consistent with the EF Core-only data-access requirement. Integration tests exercise both settings-write orderings and verify stale writes do not replace the newer defaults.
- **Review outcome**: The reviewer’s potential N+1 and race findings were not supported as stated: EF translates `Any`/correlated operations server-side, and serializable isolation protects the read through commit. The explicit-join rewrite and SQL command-count test eliminate ambiguity about the query count; no blocking query issue remains.
- **Repository evidence**: `src/Clutch.API/Application/Imports/AccountImportSettingsService.cs`; `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`; `tests/Clutch.API.Tests/Integration/Imports/AccountImportSettingsTests.cs`.
