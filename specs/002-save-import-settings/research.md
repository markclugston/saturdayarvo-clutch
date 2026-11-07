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
