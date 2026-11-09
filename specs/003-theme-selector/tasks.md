---

description: "Implementation tasks for the top-banner theme selector"
---

# Tasks: Top-Banner Theme Selector

**Input**: Design documents from `specs/004-theme-selector/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/theme-preferences.md`, `quickstart.md`

**Tests**: Included because the specification requires measurable appearance, persistence, keyboard, and WCAG outcomes, and the plan calls for API, frontend, and browser coverage.

**Organization**: Tasks are grouped by user story and ordered so each story can be verified as an incremental delivery.

## Phase 1: Setup

**Purpose**: Reuse the existing `Clutch.API`, `clutch-web`, and test projects. No project initialization or new dependency is required.

## Phase 2: Foundational

**Purpose**: No separate blocking foundation is needed; the existing React Query, Identity, EF Core, SQL Server, and test infrastructure are used by the story tasks.

## Phase 3: User Story 1 - Choose an appearance (Priority: P1) 🎯 MVP

**Goal**: Provide a keyboard- and pointer-operable Light/Dark/System selector in the authenticated top banner and apply the selected appearance without a reload.

**Independent Test**: Select each mode in the top banner and verify the corresponding appearance and selected value; verify all options by accessible role and operate the control using only the keyboard.

### Tests for User Story 1

- [X] T001 [P] [US1] Add `ThemeProvider` behavior tests in `src/clutch-web/src/components/theme/ThemeProvider.test.tsx` for the Light default, Light/Dark class changes within 500 milliseconds, and explicit System mode using the current OS preference; verify the root `.dark` class matches the effective appearance (ENG-001).
- [X] T002 [P] [US1] Add accessible selector tests in `src/clutch-web/src/components/theme/ThemeSelector.test.tsx` for the labeled native select, exactly Light/Dark/System options, selected value, and keyboard selection (ENG-001, WEB-001).
- [X] T003 [P] [US1] Add an authenticated-header test in `src/clutch-web/src/App.test.tsx` that verifies signed-in users find the theme selector in the top banner and that it is absent from the signed-out view (ENG-001, WEB-001).

### Implementation for User Story 1

- [X] T004 [US1] Extend `src/clutch-web/src/components/theme/ThemeProvider.tsx` with typed selected-mode state and an update API; make Light and Dark set the root class directly and initialize System from the current OS preference without waiting for persistence (WEB-001; all three modes apply without reload).
- [X] T005 [US1] Create `src/clutch-web/src/components/theme/ThemeSelector.tsx` as a visibly labeled native select backed by the theme provider, with exactly Light, Dark, and System and a perceivable selected value (WEB-001; pass keyboard and pointer selection tests).
- [X] T006 [US1] Add `ThemeSelector` to the authenticated shared header in `src/clutch-web/src/App.tsx` without changing the existing Light or Dark theme tokens in `src/clutch-web/src/index.css` (ARC-001, WEB-001; selector appears on authenticated application screens and existing palettes remain unchanged).

**Checkpoint**: Story 1 is independently usable with an in-memory selection; complete its targeted frontend tests before proceeding.

## Phase 4: User Story 2 - Keep a theme choice (Priority: P2)

**Goal**: Persist the selected mode for the authenticated Identity account, restore it on later visits or another device, and let the latest successful save replace earlier choices.

**Independent Test**: With SQL Server integration infrastructure, verify the default Light response, authenticated ownership, rejection of invalid modes, persistence across clients for one user, isolation between users, and last-successful-write-wins; verify a browser reload restores the saved selection and failed saves do not undo the current-visit appearance.

### Tests for User Story 2

- [X] T007 [P] [US2] Add SQL Server API integration tests in `tests/Clutch.API.Tests/Integration/Preferences/ThemePreferenceTests.cs` for absent-row Light default, authenticated GET/PUT, invalid mode and antiforgery errors, user isolation, cross-client persistence, and replacement by the latest saved mode (ENG-001, SEC-001; run against the production SQL Server provider).
- [X] T008 [P] [US2] Add preference API and runtime-schema tests in `src/clutch-web/src/features/preferences/api.test.ts` for accepted canonical modes, rejection of unsupported response values, GET/PUT request behavior, and typed save failures (ENG-001, WEB-001).
- [X] T009 [P] [US2] Add authenticated browser coverage in `src/clutch-web/e2e/theme-selector.spec.ts` for persistence after reload and on a second client, selector operation at desktop and narrow widths, visible save-failure feedback, and axe WCAG 2.2 AA checks (ENG-001, WEB-001; assert no horizontal overflow and no reported AA violations).

### Implementation for User Story 2

- [X] T010 [US2] Add the canonical `ThemeMode` type in `src/Clutch.API/Domain/Preferences/ThemeMode.cs`, accepting exactly `Light`, `Dark`, and `System` with canonical casing (ARC-001, SEC-001; unsupported values cannot be represented as valid modes).
- [X] T011 [US2] Create the preference entity in `src/Clutch.API/Infrastructure/Persistence/Entities/UserThemePreference.cs` with these data-model constraints verbatim: `UserId: Required; primary key and foreign key to AspNetUsers.Id; taken from the authenticated principal, never from request data.` `Mode: Required; one of Light, Dark, or System.` `UpdatedAtUtc: Required; server-generated UTC time for the most recent successful save.` (DOT-001, DOT-002, SEC-001; user deletion cascades to its preference).
- [X] T012 [US2] Configure the `UserThemePreferences` set and Identity-user cascade relationship in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs` (DOT-002; the database enforces one optional preference per user).
- [X] T013 [US2] Generate the SQL Server migration under `src/Clutch.API/Infrastructure/Persistence/Migrations/` and update `src/Clutch.API/Infrastructure/Persistence/Migrations/AppDbContextModelSnapshot.cs` for the user-keyed preference table and cascade; review the migration for data loss (OPS-001, DOT-002; existing users require no backfill and read as Light).
- [X] T014 [US2] Implement asynchronous read/upsert operations in `src/Clutch.API/Application/Preferences/ThemePreferenceService.cs`, using only the authenticated user ID, `AsNoTracking()` for reads, server-generated UTC timestamps, and a single replacement row per user (DOT-001, DOT-002, SEC-001; absent rows read as Light and the latest committed save wins).
- [X] T015 [US2] Add authenticated GET/PUT `/api/preferences/theme` routes in `src/Clutch.API/Api/Endpoints/ThemePreferenceEndpoints.cs`; validate exact mode values, derive ownership from the authenticated principal, and preserve standard ProblemDetails and antiforgery behavior (ARC-001, SEC-001; implement the response and error contract in `specs/004-theme-selector/contracts/theme-preferences.md`).
- [X] T016 [US2] Register `ThemePreferenceService` and map its endpoint group in `src/Clutch.API/Program.cs` (ARC-001, DOT-001; authenticated preference routes are reachable through the existing API pipeline).
- [X] T017 [P] [US2] Add a strict `ThemePreferenceSchema` and inferred type in `src/clutch-web/src/lib/api/schemas.ts` for exactly the canonical Light/Dark/System values (WEB-001, SEC-001; malformed server responses are rejected at runtime).
- [X] T018 [US2] Implement typed GET/PUT preference functions and React Query hooks in `src/clutch-web/src/features/preferences/api.ts` using the shared API client and preference schema (WEB-001; PUT uses existing antiforgery handling and API failures remain typed).
- [X] T019 [US2] Connect server preference loading/saving to `src/clutch-web/src/components/theme/ThemeSelector.tsx` and `src/clutch-web/src/App.tsx`; initialize to Light when no preference is available, apply changes immediately, show a visible error on save failure without reverting the current visit, and prevent cached account preferences from leaking across sign-out/account changes (WEB-001, SEC-001; reload uses the latest server mode).

**Checkpoint**: Stories 1 and 2 work together; verify the SQL Server integration suite and authenticated persistence journey before proceeding.

## Phase 5: User Story 3 - Follow system appearance when requested (Priority: P3)

**Goal**: While System is selected, track OS color-scheme changes; while Light or Dark is selected, ignore those changes.

**Independent Test**: Select System and switch the OS preference both ways, verifying each effective appearance updates within one second. Repeat under Light and Dark and verify they remain fixed.

### Tests for User Story 3

- [X] T020 [P] [US3] Extend `src/clutch-web/src/components/theme/ThemeProvider.test.tsx` to simulate both OS color-scheme transitions, verify updates within the event cycle only in System mode, and verify listener cleanup on mode change and unmount (ENG-001, WEB-001).

### Implementation for User Story 3

- [X] T021 [US3] Update `src/clutch-web/src/components/theme/ThemeProvider.tsx` to subscribe to `prefers-color-scheme` changes only while System is selected, apply both light-to-dark and dark-to-light updates, use Light when the preference is unavailable, and remove listeners when no longer needed (WEB-001; satisfy the one-second response criterion and keep explicit modes fixed).

**Checkpoint**: All three modes now satisfy current and changing OS preference behavior.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete required independent reviews and run the feature's full validation guide.

- [X] T022 Obtain an independent review of the EF Core query and generated SQL Server migration for query shape, indexing, round trips, and data loss in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs` and `src/Clutch.API/Infrastructure/Persistence/Migrations/` (DOT-002, OPS-001; resolve any material findings before acceptance).
- [X] T023 Obtain an independent OWASP Top 10 review of the authenticated preference API and frontend persistence flow in `src/Clutch.API/Api/Endpoints/ThemePreferenceEndpoints.cs` and `src/clutch-web/src/features/preferences/api.ts` (SEC-001; remediate and retest every vulnerability found).
- [ ] T024 Run the commands and manual scenarios in `specs/004-theme-selector/quickstart.md`, including API integration, frontend typecheck/lint/tests/build, authenticated Playwright/axe at desktop and narrow widths, manual visible-focus and 200% zoom/320 CSS px reflow checks, and the SC-005 usability check; record any required result or scenario updates in `specs/004-theme-selector/quickstart.md` (ENG-001, WEB-001; all listed checks pass and at least 9 of 10 participants complete all three requested mode-selection and identification tasks without assistance).

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Existing projects and dependencies are reused; no setup work blocks implementation.
- **Foundational (Phase 2)**: No separate foundational change is needed.
- **User Stories (Phases 3-5)**: Story 1 can start immediately. Stories 2 and 3 depend on Story 1's selector and theme provider; Story 2 adds saved state, and Story 3 completes live System-mode OS tracking.
- **Polish (Phase 6)**: Depends on the implementation stories; independent reviews and full validation gate completion.

### User Story Dependencies

- **US1 (P1)**: No prerequisite story; delivers the MVP selector and immediate appearance changes.
- **US2 (P2)**: Depends on US1's selector/provider to load and save the mode used by the UI.
- **US3 (P3)**: Depends on US1's provider and mode state; it does not depend on the account persistence implementation in US2.

### Parallel Opportunities

- US1: T001, T002, and T003 can be authored in parallel because they cover separate test files. After those tests, T004, T005, and T006 are sequential because the selector consumes provider state and App integrates the selector.
- US2: T007, T008, and T009 can be authored in parallel. T010 precedes T011-T016 on the API side; T017 can proceed in parallel with API model/service work, then T018 and T019 follow their frontend contract dependencies.
- US3: T020 can be prepared independently of the US3 implementation; T021 follows it.
- Cross-cutting: T022 and T023 are independent reviews and can run in parallel after the relevant implementation is available.

### Parallel Example: User Story 1

```text
Task: T001 ThemeProvider behavior tests in src/clutch-web/src/components/theme/ThemeProvider.test.tsx
Task: T002 ThemeSelector accessibility tests in src/clutch-web/src/components/theme/ThemeSelector.test.tsx
Task: T003 authenticated-header test in src/clutch-web/src/App.test.tsx
```

### Parallel Example: User Story 2

```text
Task: T007 SQL Server API integration tests in tests/Clutch.API.Tests/Integration/Preferences/ThemePreferenceTests.cs
Task: T008 preference API/schema tests in src/clutch-web/src/features/preferences/api.test.ts
Task: T009 authenticated browser tests in src/clutch-web/e2e/theme-selector.spec.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Reuse the existing projects and complete T001-T006.
2. Verify Story 1 independently: the authenticated header exposes exactly three accessible choices and Light/Dark/System apply without a reload.
3. Stop for an MVP check before adding account persistence.

### Incremental Delivery

1. Complete US1 and validate the selector and immediate appearance behavior.
2. Complete US2 and validate authenticated SQL Server persistence, user isolation, reload, and cross-client last-save-wins behavior.
3. Complete US3 and validate live OS changes in System mode while Light/Dark remain fixed.
4. Complete independent reviews and all checks in `specs/004-theme-selector/quickstart.md`.
