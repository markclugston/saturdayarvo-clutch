# Clutch Code Map

The source code is the only source of truth. This file holds no facts, only where to look, so
it doesn't need updating when code changes. If a pointer is missing, or the file no longer
contains what's described, search for the concern and update the pointer.

**Convention by example:** before adding a file, open its nearest sibling in the same area
(same folder, or the same layer in another area) and follow its pattern. Don't invent structure.

| To find… | Read |
|---|---|
| Projects in the solution | the `.slnx` file at the repository root |
| .NET stack, package versions, build settings | `src/Clutch.API/Clutch.API.csproj`, `tests/Clutch.API.Tests/Clutch.API.Tests.csproj` |
| Frontend stack, versions and npm scripts (build, lint, typecheck, test, e2e) | `src/clutch-web/package.json` |
| Service registration, middleware, health endpoints, OpenTelemetry meters | `src/Clutch.API/Program.cs` |
| EF Core, Identity, auth cookies | `src/Clutch.API/Infrastructure/DependencyInjection.cs` |
| Sign-in, session and CSRF endpoints | `src/Clutch.API/Api/Security/` |
| Error responses (ProblemDetails) | `src/Clutch.API/Api/ProblemDetails/` |
| Endpoint pattern | any file in `src/Clutch.API/Api/Endpoints/` |
| Use cases, metrics per area | `src/Clutch.API/Application/<Area>/` (e.g. `Imports/ImportMetrics.cs`) |
| Domain model, account ownership, audit events | `src/Clutch.API/Domain/<Area>/`, `Domain/Audit/` |
| Database model and migrations | `src/Clutch.API/Infrastructure/Persistence/` |
| Unit test pattern | a sibling in `tests/Clutch.API.Tests/Unit/<Area>/` |
| Integration test pattern, Docker SQL Server fixture and its test trait | `tests/Clutch.API.Tests/Integration/Accounts/SqlServerFixture.cs` and a sibling test in the same area |
| API client, CSRF handling, response schemas | `src/clutch-web/src/lib/api/` |
| Frontend feature pattern (components, `api.ts`, hooks, tests) | a sibling folder in `src/clutch-web/src/features/` |
| UI primitives and their variants (`class-variance-authority`), class merging (`cn`) | `src/clutch-web/src/components/ui/`, `src/clutch-web/src/lib/utils.ts` |
| Theme runtime and tokens (colours, radii, shadow, font, focus ring, hairlines, reduced motion) | `src/clutch-web/src/components/theme/`, `src/clutch-web/src/index.css` |
| Lint configuration (typescript-eslint rules applied) | `src/clutch-web/eslint.config.js` |
| Compiler strictness | `src/clutch-web/tsconfig.app.json`, `tsconfig.node.json` |
| Style lint rule (`clutch/style-tokens`) and its tests | `src/clutch-web/eslint-rules/clutch-style.js`, `clutch-style.test.js` |
| Percentage and currency entry fields; display formatting of amounts | `src/clutch-web/src/features/mortgages/FormattedNumberField.tsx`; `src/clutch-web/src/lib/formatCurrencyAmount.ts` |
| Style-guide browser states (axe, focus, surfaces, screenshots) | `src/clutch-web/e2e/style-guide.spec.ts`, `playwright.style-guide.config.ts` |
| Component test helpers | `src/clutch-web/src/test/` |
| Browser test setup: mocked-API config, real-API config and its user provisioning | `src/clutch-web/playwright.config.ts`, `playwright.integration.config.ts`, `e2e/integration-setup.ts`, `e2e/fixtures.ts` |
| Local run and debug setup | `.vscode/launch.json`, `README.md` |

**Settled decisions:** a behaviour already implemented in the code (auth, ownership, error
format, audit storage, telemetry, data fetching and validation) is settled. Specify, clarify and
plan record it as an assumption, citing the file above, and never raise it as NEEDS
CLARIFICATION. Only a feature that changes it should discuss it.
