---
description: "Implementation tasks for the categories and groups screen"
---

# Tasks: Categories and Groups Screen

**Input**: Design documents from `specs/007-categories-groups/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/category-nodes.md`, `quickstart.md`

**Tests**: Included, because the constitution (ENG-001, WEB-001) requires tests for added behavior.

**Organization**: Tasks are grouped by user story so each can be implemented and validated independently after the foundational phase.

## Phase 1: Setup

**Purpose**: Project initialization.

The API, frontend, test projects, and tooling already exist. No setup changes are required. No new dependencies are added.

## Phase 2: Foundational

**Purpose**: Entity, persistence, navigation shell, and shared client plumbing needed by every story.

- [X] T001 Create the `CategoryNode` entity in `src/Clutch.API/Domain/Categories/CategoryNode.cs` with private setters and a factory returning a typed result (no exceptions for validation): `Id`, `OwnerUserId` (required), `ParentId` (optional; empty means group), `Name` (trimmed, "1 to 100 characters; not whitespace-only"), `Position` (integer); add a name validator in `src/Clutch.API/Domain/Categories/CategoryNameValidator.cs` (ARC-001, DOT-001; pass when the project builds and the factory rejects invalid names).
- [X] T002 Map `CategoryNodes` in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`: `DbSet`, name max length 100, self-referencing `ParentId` foreign key with no cascade, unique index on `(OwnerUserId, ParentId, Name)` ("case-insensitive", relying on the database's case-insensitive collation), unique index on `(OwnerUserId, ParentId, Position)`, and lookup index on `(OwnerUserId, ParentId)` (DOT-002).
- [X] T003 Generate the migration with `dotnet ef migrations add CategoryNodes --project src/Clutch.API/Clutch.API.csproj --output-dir Infrastructure/Persistence/Migrations` and review it in `src/Clutch.API/Infrastructure/Persistence/Migrations/`; it must only add the `CategoryNodes` table and indexes, and its downgrade drops the table (DOT-002, OPS-001; pass when no other tables change).
- [X] T004 [P] Add the Zod `CategoryNodeSchema` (`id`, `parentId` nullable, `name`, `depth`) and its type to `src/clutch-web/src/lib/api/schemas.ts`, following the existing schemas (WEB-001).
- [X] T005 Add header navigation buttons "Accounts" and "Categories" (button elements, pointer cursor, `aria-current` on the active one) and a `showCategories` state in `src/clutch-web/src/App.tsx`; Accounts remains the default; reset state on sign out like the existing state; render a placeholder `CategoriesPage` import from `src/clutch-web/src/features/categories/CategoriesPage.tsx` (create a minimal component) (WEB-001; pass when `tsc --noEmit` passes and existing App tests still pass).
- [X] T024 [P] Add navigation tests for the Accounts and Categories buttons (switching, default screen, `aria-current`, pointer cursor class) in `src/clutch-web/src/App.test.tsx` (WEB-001).

**Checkpoint**: Entity, table, and navigation exist; stories can begin.

## Phase 3: User Story 1 - Create and view groups (Priority: P1) 🎯 MVP

**Goal**: A user can create groups, which appear at the bottom of the list, with name validation.

**Independent Test**: Open Categories, create two groups, confirm creation order and validation messages.

- [X] T006 [P] [US1] Add unit tests for `CategoryNode` and name validation (valid, empty, whitespace-only, 101 characters) in `tests/Clutch.API.Tests/Unit/Categories/CategoryNodeTests.cs` (ENG-001).
- [X] T007 [P] [US1] Add SQL Server integration tests for group creation, bottom placement, empty-name 400, duplicate group name (case-insensitive) 409, cross-user isolation, and display order in `tests/Clutch.API.Tests/Integration/CategoryNodeEndpointsTests.cs`, following existing integration test patterns (ENG-001, DOT-002, SEC-001).
- [X] T008 [US1] Implement `CategoryNodeService` in `src/Clutch.API/Application/Categories/CategoryNodeService.cs` with `GetTreeAsync` (one `AsNoTracking` query for the owner's nodes, depth-first display order with `depth`) and `CreateAsync` for groups (position = max sibling position + 1, sibling duplicate check, typed results, single retry on unique-index conflict); register it in dependency injection where `AccountService` is registered (ARC-001, DOT-001, DOT-002).
- [X] T009 [US1] Add `src/Clutch.API/Api/Endpoints/CategoryNodeEndpoints.cs` with `GET /api/category-nodes` and `POST /api/category-nodes` per `contracts/category-nodes.md` (authorization required, owner from claims, 401 when no id, `ProblemDetails` for 400/409) and map it in `src/Clutch.API/Program.cs` next to the account endpoints (SEC-001, SEC-003, DOT-001).
- [X] T010 [US1] Create `src/clutch-web/src/features/categories/api.ts` (`getCategoryNodes`, `createCategoryNode` using `apiRequest` and `CategoryNodeSchema`) and build `CategoriesPage` in `src/clutch-web/src/features/categories/CategoriesPage.tsx` with React Query: list, empty state ("no groups" message inviting group creation), a create form with a name field and busy state, validation and server-error messages in `role="alert"`, and stable `id` keys (WEB-001, Principle VII).
- [X] T011 [P] [US1] Add component tests in `src/clutch-web/src/features/categories/CategoriesPage.test.tsx` for empty state, creating a group, empty-name message, duplicate-name error, and API failure, using accessible roles and names (WEB-001, ENG-001).

**Checkpoint**: Groups can be created and listed; MVP deliverable.

## Phase 4: User Story 2 - Create categories under a group or category (Priority: P1)

**Goal**: A user creates categories choosing a parent from an indented dropdown; each appears at the bottom of its parent's children.

**Independent Test**: With a group present, create a category under it and a category under that category.

- [X] T012 [P] [US2] Extend `tests/Clutch.API.Tests/Integration/CategoryNodeEndpointsTests.cs` with category creation under a group and under a category, bottom placement among siblings, unknown or other-user `parentId` returning 404, same name allowed under different parents, and duplicate under the same parent returning 409 (ENG-001, SEC-001).
- [X] T013 [US2] Extend `CategoryNodeService.CreateAsync` in `src/Clutch.API/Application/Categories/CategoryNodeService.cs` to accept `ParentId`, verify the parent belongs to the owner (not found otherwise), and assign position among the parent's children (DOT-002, SEC-001).
- [X] T014 [US2] Add a parent dropdown to the create form in `src/clutch-web/src/features/categories/CategoriesPage.tsx`: native select, first option "None (create a group)", then every node in display order indented by depth; when no nodes exist show that a group must be created first; choosing a parent creates a category; the name is required (WEB-001; pass when keyboard operable and labeled).
- [X] T015 [P] [US2] Add component tests for dropdown contents and order, creating a category under a group and under a category, and the no-groups message in `src/clutch-web/src/features/categories/CategoriesPage.test.tsx` (WEB-001, ENG-001).

**Checkpoint**: Full hierarchy creation works.

## Phase 5: User Story 3 - Read the hierarchy clearly (Priority: P2)

**Goal**: Groups render larger than categories, categories are indented by depth, and a gap separates groups.

**Independent Test**: With two groups holding nested categories, verify size, indentation, and gaps.

- [X] T016 [US3] Style the list in `src/clutch-web/src/features/categories/CategoriesPage.tsx`: render each group block as a list item with the group name in a larger heading-style size, categories in a smaller size with indentation per `depth`, and a vertical gap between group blocks; use Tailwind utilities, theme tokens, and `cn()`; support light and dark themes; no reorder or move controls (WEB-001; pass when visual checks in T017 and T018 pass).
- [X] T017 [P] [US3] Add component tests in `src/clutch-web/src/features/categories/CategoriesPage.test.tsx` asserting group elements use a larger text class than category elements, deeper nodes have greater indentation, group blocks are separated, and no reorder controls exist, plus keyboard operation of the form, Rename, and Delete controls and the delete dialog's focus handling (FR-009 to FR-012, FR-019; WEB-001).
- [X] T018 [P] [US3] Create `src/clutch-web/e2e/categories-groups.spec.ts`: sign in, open Categories via the header button, create two groups and nested categories, verify order and presentation in light and dark themes (FR-018) (following `src/clutch-web/e2e/theme-selector.spec.ts`), reload and verify persistence, and verify no reorder controls (WEB-001, ENG-001).

**Checkpoint**: The list is readable and persistent.

## Phase 6: User Story 4 - Rename and delete (Priority: P3)

**Goal**: A user renames any item and deletes an item and its descendants after a warning.

**Independent Test**: Rename an item; delete a group with children, cancelling first then confirming.

- [X] T019 [P] [US4] Extend `tests/Clutch.API.Tests/Integration/CategoryNodeEndpointsTests.cs` with rename (keeps position and parent, empty name 400, sibling duplicate 409, other-user 404), `deletion-impact` count, and subtree delete (descendants removed, siblings untouched, 204, other-user 404) (ENG-001, SEC-001).
- [X] T020 [US4] Add `RenameAsync`, `GetDeletionImpactAsync`, and `DeleteAsync` to `src/Clutch.API/Application/Categories/CategoryNodeService.cs`: delete loads the owner's nodes once, collects the node and all descendants, and removes them in one save (DOT-002, SEC-001).
- [X] T021 [US4] Add `PATCH /api/category-nodes/{id}`, `GET /api/category-nodes/{id}/deletion-impact`, and `DELETE /api/category-nodes/{id}` to `src/Clutch.API/Api/Endpoints/CategoryNodeEndpoints.cs` per the contract (SEC-001, SEC-003).
- [X] T022 [US4] Add `renameCategoryNode`, `getDeletionImpact`, and `deleteCategoryNode` to `src/clutch-web/src/features/categories/api.ts`; add per-item Rename (inline edit with Save and Cancel, same validation messages) and Delete buttons to `CategoriesPage.tsx`; create `src/clutch-web/src/features/categories/DeleteCategoryDialog.tsx`, an accessible modal that states the item and all categories beneath it will be deleted, shows the item count, and asks whether to continue with Cancel and Delete buttons; deletion only happens on confirm (WEB-001, Principle VII).
- [X] T023 [P] [US4] Add component tests in `src/clutch-web/src/features/categories/CategoriesPage.test.tsx` for rename, duplicate rename error, delete warning text and count, cancel leaving the list unchanged, confirm removing the subtree, and return to the empty state after deleting the last group; extend `src/clutch-web/e2e/categories-groups.spec.ts` with the rename and delete journey (WEB-001, ENG-001).

**Checkpoint**: All stories complete.

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T025 Run `dotnet test tests\Clutch.API.Tests`, then `npx tsc --noEmit`, `npm run lint` (zero warnings), `npm test`, `npm run build`, and `npm run test:e2e:ownership` in `src/clutch-web`, per `quickstart.md`; fix all failures (ENG-001, WEB-001).
- [X] T026 Obtain an independent review of the EF Core queries, indexes, and migration for query shape, indexing, and round trips, and address findings (DOT-002, Principle III).
- [X] T027 Obtain an independent OWASP Top 10 review of all changed code, address and verify every finding, and rerun relevant checks (SEC-001, Principle V).

## Dependencies & Execution Order

- Phase 2 blocks all stories. Within it: T001 → T002 → T003; T004 and T005 are independent of those; T024 follows T005.
- US1 (T006–T011) is the MVP. US2 (T012–T015) depends on US1's service, endpoints, and page. US3 (T016–T018) depends on US1 and is best verified after US2. US4 (T019–T023) depends on US1 and is independent of US3.
- Within a story: tests, then service, then endpoints, then UI.
- Polish (T025–T027) follows all stories.

## Parallel Examples

- Phase 2: T004 and T005 alongside T001–T003.
- US1: T006, T007, and T011 can be drafted in parallel; backend T008–T009 and frontend T010 proceed in parallel after the API contract is fixed.
- After US1: US3 and US4 can proceed in parallel by different agents, except for edits to the shared `CategoriesPage.tsx`, which must be merged sequentially.

## Implementation Strategy

1. Complete Phase 2.
2. Deliver US1 as the MVP and validate it.
3. Add US2 for the full hierarchy, then US3 for presentation, then US4 for rename and delete.
4. Finish with Polish and both independent reviews.

## Phase 8: Convergence

- [X] T028 Make the delete confirmation in `src/clutch-web/src/features/categories/DeleteCategoryDialog.tsx` move keyboard focus into the dialog when it opens (for example to Cancel), return focus to the triggering Delete button when it closes (cancel, confirm, or Escape), and close on Escape; the dialog is currently inline with no focus management per FR-019 (partial)
- [X] T029 After a rename is saved or cancelled in `src/clutch-web/src/features/categories/CategoriesPage.tsx`, return focus to that item's Rename button so keyboard users do not lose their place per FR-019 (partial)
- [X] T030 Add component tests in `src/clutch-web/src/features/categories/CategoriesPage.test.tsx` asserting focus moves into the delete dialog, returns to the Delete button on cancel, and Escape closes it, and that focus returns after rename per FR-019 (missing)
- [X] T031 Add the pointer-cursor assertion for the Accounts and Categories navigation buttons in `src/clutch-web/src/App.test.tsx`, which T024 required but the navigation test does not check per T024 (partial)
