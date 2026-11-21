# Implementation Plan: Remember Navigation Expanded State

**Branch**: `018-persist-nav-state` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

## Summary

Persist the hamburger pinned/unpinned choice per user, exactly as the theme preference (003) is
persisted: a user-keyed SQL Server row behind authenticated `GET`/`PUT /api/preferences/navigation`.
On sign-in or open, the app keeps the existing startup loading dialog up until the preference has
loaded (request aborted at 2 s), then seeds the navigation's pinned state before the shell first
renders, so there is no compact-to-pinned jump. Toggling updates the UI at once and saves in the
background; failures show a toast and never block.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).
Do not restate them.

**Feature-specific changes**:

- Schema: new table `UserNavigationPreferences` + migration ([data-model.md](./data-model.md)).
- Endpoints: `GET`/`PUT /api/preferences/navigation` ([contract](./contracts/navigation-preferences.md)).
- New meter `Clutch.API.Preferences` (navigation save outcomes/duration).
- clutch-web: preference API hooks, startup gating in `App.tsx`, `useNavigationExpansion` seeded
  from the saved state and saving on toggle. No new packages.

**Performance Goals**: Preference wait capped at 2 s after session load even when the request is
slow or fails (SC-006); tests allow 500 ms render tolerance (signed-in screen within 2.5 s); hamburger visibly toggles synchronously (≪ 500 ms, FR-010).

**Constraints**: No compact-to-pinned jump (FR-007); a late preference never applies (FR-002a);
hover/focus never saves (FR-003); no localStorage (per-user, not per-browser).

**Scale/Scope**: One small row per user; one endpoint pair; one hook and the App startup path.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
*Procedure: `clutch-constitution-check` skill. One row per ID; use N/A with a reason when an ID does not apply.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | `NavigationState` in Domain; service in Application; entity/mapping in Infrastructure; endpoint only maps HTTP. UI in clutch-web. No extra features (no live cross-device push, no generic settings). | Review | PASS |
| DOT-001 | Yes | .NET 10 API project, DI, async + cancellation, warnings-as-errors as existing. | Build, tests | PASS (build 0 warnings; 281/281 API tests) |
| DOT-002 | Yes | EF Core only; `AsNoTracking` PK lookup; serializable upsert via execution strategy (sibling pattern). | Independent query review; SQL Server Testcontainers integration tests (default, round-trip, isolation, last-save-wins, invalid value) | PASS (query review in [reviews.md](./reviews.md); 19/19 navigation preference tests including concurrent saves) |
| AUD-001 | No | Preference changes are not audit events (spec assumption, same as theme). | — | N/A |
| ENG-001 | Yes | API integration tests, Vitest component/hook tests, Playwright journeys; all automated. | Test tasks, quality gates | PASS for 018 and navigation tests; specs needing a running API not yet run (see quickstart.md results) |
| OPS-001 | Yes | Additive migration (new table only), `Down` drops it, no backfill needed; structured log on save failure; existing health checks unchanged. | Migration review, logging | PASS (migration review in [reviews.md](./reviews.md); failure logged without body) |
| SEC-001 | Yes | `RequireAuthorization`; user ID from principal only; allow-listed `state` (400 otherwise) plus DB check constraint; PUT protected by existing antiforgery; Zod-validated response. No new dependencies. | Independent OWASP Top 10 + dependency review | PASS (one medium finding F1, remediated and verified; no vulnerable .NET or npm packages; see [reviews.md](./reviews.md)) |
| SEC-002 | No | No configuration, credentials or integrations touched. | — | N/A |
| SEC-003 | No | Pinned/unpinned is not personal, payment or financial data; logs omit request bodies; ProblemDetails reveal nothing sensitive. | — | N/A |
| WEB-001 | Yes | TypeScript; React Query + Zod boundary; toast uses existing component and sentence-case text; no new visible labels; hamburger `aria-expanded` and focus unchanged; axe in e2e. | Frontend gates (typecheck, lint, test, build, e2e), UI compliance checklist | PASS: typecheck, lint, 477/477 Vitest, build and 35/35 navigation e2e pass; UI checklist complete. Specs needing a running API were not run (see quickstart.md) |
| Perf & Observability | Yes | Toggle applies synchronously before the save; startup wait capped at 2 s; `PreferenceMetrics` counter + histogram registered in `Program.cs`. | 500 ms feedback test, metrics registered | PASS (Vitest toggle test, 2.5 s e2e test, `PreferenceMetricsTests`, meter registered) |

**Applicable style guide sections**: §2 Layout model and §3 Navigation
(`clutch-ui-style/references/layout-navigation.md`) — starting state only; behaviour from 011/015
is unchanged. Toast text follows the sentence-case rule in §11.

**UI compliance checklist** (style guide §11):

- [x] No borders or divider lines on layout containers (documented hairline exception only) — no containers or classes added
- [x] Surface hierarchy follows canvas, content, card, raised — no surfaces added
- [x] Only tokens used: no raw hex, no default palette, no non-token radius — no styles added
- [x] Form fields use floating labels — N/A, no form fields added
- [x] Labels, headings and button text use Title Case; helper, error and body text use sentence case — only new text is the sentence-case save-failure toast
- [x] Percentage and currency fields reject invalid characters at entry and reformat on blur — N/A, none added
- [x] Navigation expand/collapse behaviour unchanged; only restyled, unless an approved spec amends it (018 amends the starting state only) — all 35 `navigation.spec.ts` journeys pass after `07ae269`. Since `cbc27b3` (before 018) keyboard focus no longer expands the navigation; specs 011/015/018 were amended on 2026-11-22 to match
- [x] Dark theme has no pure black surface or pure white text — no surfaces added
- [x] Both themes visually verified — pinned-start screenshots in light and dark (`navigation.spec.ts` pinned-start axe test)
- [x] WCAG 2.2 AA contrast checked in both themes — axe passes with pinned start in light and dark
- [x] Visible focus ring on every interactive element — e2e focus-indicator journeys pass in both themes after `07ae269`
- [x] Status not conveyed by colour alone — save failure is a text toast
- [x] `prefers-reduced-motion` respected (pinned start applies with no transition) — reduced-motion pinned-start e2e test passes

**Pre-research gate**: PASS — no violations; PENDING rows are implementation-time gates that need tasks.

## Project Structure

### Documentation (this feature)

```text
specs/018-persist-nav-state/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── navigation-preferences.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/Clutch.API/
├── Domain/Preferences/NavigationState.cs                         # new
├── Application/Preferences/NavigationPreferenceService.cs        # new (sibling: ThemePreferenceService)
├── Application/Preferences/PreferenceMetrics.cs                  # new (sibling: Mortgages/MortgageMetrics)
├── Api/Endpoints/NavigationPreferenceEndpoints.cs                # new (sibling: ThemePreferenceEndpoints)
├── Infrastructure/Persistence/Entities/UserNavigationPreference.cs  # new
├── Infrastructure/Persistence/AppDbContext.cs                    # DbSet + mapping
├── Infrastructure/Persistence/Migrations/*_AddNavigationPreferences.cs # new migration + snapshot
├── Infrastructure/DependencyInjection.cs                         # register service
└── Program.cs                                                    # map endpoints, add meter

tests/Clutch.API.Tests/Integration/Preferences/NavigationPreferenceTests.cs  # new
tests/Clutch.API.Tests/Unit/Preferences/PreferenceMetricsTests.cs           # new (sibling: Unit/Mortgages/MortgageMetricsTests)

src/clutch-web/
├── src/lib/api/schemas.ts                                        # NavigationState/Preference schemas
├── src/features/preferences/api.ts                               # get/save + hooks (timeout, scope)
├── src/features/preferences/api.test.ts                          # extend
├── src/App.tsx                                                   # startup gating, seeded pinned, save on toggle
│                                                                 # (also: hover only at >= 768px, from 011 FR-014, not 018)
├── src/lib/useMediaQuery.ts                                      # new, serves 011 FR-014 only, not a 018 requirement
├── src/App.test.tsx                                              # extend
├── e2e/navigation.spec.ts                                        # persisted-state journeys + mock
└── e2e/style-guide.spec.ts, e2e/import-settings.spec.ts         # add navigation preference mock to /api/* routes
```

**Structure Decision**: Existing layout, following the 003 theme-preference siblings. No deviation.

## Phase 0 / Phase 1 outputs

- [research.md](./research.md): R1–R8 decisions (storage, API, ordering, 2 s gating, failure feedback, what does not save, metrics, e2e mocks).
- [data-model.md](./data-model.md), [contracts/navigation-preferences.md](./contracts/navigation-preferences.md), [quickstart.md](./quickstart.md).

### Post-Design Constitution Check

- ARC-001 PASS: layering mirrors theme preference; nothing beyond the spec.
- DOT-002 / OPS-001 PASS: PK lookup needs no extra index; migration is additive with drop-table rollback. Query and migration reviews completed ([reviews.md](./reviews.md)).
- SEC-001 PASS: contract accepts no user ID; two-layer allow-list; OWASP review completed, finding F1 remediated.
- WEB-001 PASS: no new controls; UI compliance checklist validated above.
- Perf & Observability PASS: metrics and 2 s cap covered by tests.

**Post-design gate result**: PASS. No unresolved clarifications; no unjustified deviations.

## Complexity Tracking

No constitutional violations require justification.
