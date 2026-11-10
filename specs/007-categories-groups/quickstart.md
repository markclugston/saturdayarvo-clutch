# Quickstart: Validating Categories and Groups

All checks are agent-executable. See [data-model.md](data-model.md) and [contracts/category-nodes.md](contracts/category-nodes.md) for details.

## Prerequisites

- .NET 10 SDK, Node.js, and a container runtime for the SQL Server integration tests.
- Frontend dependencies installed in `src/clutch-web`.

## API tests

```powershell
dotnet test tests\Clutch.API.Tests
```

Expect passing tests for: group and category creation, bottom placement, nested parents, empty/whitespace and over-length names, case-insensitive sibling duplicates (and same name allowed under different parents), rename keeping position, subtree delete with correct item count, cross-user denial (404), display order, and the migration on SQL Server.

## Frontend checks

```powershell
cd src\clutch-web
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Expect zero lint warnings and passing component tests for the Categories page (sizes, indentation, gaps, dropdown contents, validation messages, delete confirmation and cancel, empty state, no reorder controls) and the navigation buttons.

## Browser end-to-end

```powershell
cd src\clutch-web
npm run test:e2e:ownership
```

Scenario: sign in, open Categories from the header, create two groups, create nested categories, confirm order and the group/category presentation in light and dark themes, reload and confirm persistence, rename an item, attempt a duplicate, delete a group with children via the warning dialog (cancel, then confirm).

## Review gates

- Independent review of the EF Core queries and migration (Principle III).
- Independent OWASP Top 10 review of the changed code (Principle V).
