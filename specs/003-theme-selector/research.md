# Research: Top-Banner Theme Selector

## Existing Theme System

**Decision**: Retain `clutch-web/src/index.css` semantic light/dark tokens and the root `.dark` class. Extend the existing theme provider so Light and Dark set the effective class directly, while System follows `matchMedia('(prefers-color-scheme: dark)')` and its change event.

**Rationale**: The app already maps both palettes through the same semantic tokens. The existing provider follows the OS preference but has no user-selected mode or persistence. Reusing the class/token mechanism changes selection behavior without redesigning either palette.

**Alternatives considered**: Add a second palette or rewrite token styling. Both are out of scope and risk changing the existing visual designs.

## Account-Scoped Preference Persistence

**Decision**: Store a single optional theme-mode row keyed by the authenticated Identity user in SQL Server. Read an absent row as Light; save only explicit user choices through an authenticated API.

**Rationale**: Browser storage is device-local and cannot meet the spec's same-account cross-device requirement. The API already uses Identity claims, EF Core, SQL Server, cookie authentication, antiforgery, and typed ProblemDetails errors. A user-keyed row avoids coupling the theme choice to family/account business data. A successful later write replaces the previous mode.

**Alternatives considered**:
- Browser local storage: rejected because it cannot synchronize across devices and can retain stale values after sign-in changes.
- Add the mode to the authentication session response: rejected because a preference has its own update lifecycle and contract; a dedicated resource keeps session identity semantics unchanged.
- Add a general user-settings framework: rejected because a single preference does not justify a broader abstraction.

## Frontend Selector and Server State

**Decision**: Use React Query for server preference loading/saving and a native, visibly labeled `<select>` in the shared authenticated header. Apply the current mode in the client without waiting for the save; expose a visible error if a save fails.

**Rationale**: React Query is already the app's server-state library, and native select controls provide keyboard operation, an exposed selected value, and narrow-screen behavior without adding a dependency. The existing shared header appears on the authenticated application surfaces.

**Alternatives considered**:
- Hand-built menu: rejected because it requires custom keyboard, focus, and announcement behavior.
- Browser persistence as an optimistic source of truth: rejected because it can conflict with the account's latest saved value.

## Validation and Security

**Decision**: Validate the exact three allowed modes at the API and validate JSON responses with the existing Zod-based API schema pattern. Cover persistence and ownership with SQL Server integration tests, selector behavior with accessible-role frontend tests, and the authenticated responsive journey with Playwright/axe.

**Rationale**: The repository already has request/response schema validation, cookie authentication with antiforgery on mutations, WebApplicationFactory integration tests backed by SQL Server Testcontainers, and Playwright with axe.

**Alternatives considered**: EF InMemory-only persistence tests were rejected because the feature's persistence behavior and migration target SQL Server.

## Repository Evidence

- `src/clutch-web/src/index.css`: semantic theme tokens and `.dark` palette.
- `src/clutch-web/src/components/theme/ThemeProvider.tsx`: current OS preference listener.
- `src/clutch-web/src/App.tsx`: shared authenticated header.
- `src/Clutch.API/Api/Security/SecurityEndpoints.cs`: authenticated Identity session pattern.
- `src/Clutch.API/Api/Endpoints/AdminImportLimitEndpoints.cs`: authenticated API endpoint and request/response record pattern.
- `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`: EF Core model configuration.
- `src/Clutch.API/Application/Imports/AccountImportSettingsService.cs`: EF async operations and serializable write pattern.
- `tests/Clutch.API.Tests/Integration/Accounts/SqlServerFixture.cs`: SQL Server Testcontainers integration setup.
- `src/clutch-web/src/lib/api/client.ts` and `schemas.ts`: typed API errors, antiforgery, and Zod runtime validation.
- `src/clutch-web/e2e/fixtures.ts` and `playwright.config.ts`: authenticated Playwright setup and browser test configuration.
