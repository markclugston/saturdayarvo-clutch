# Research: Categories and Groups Screen

## Decision 1: Model groups and categories as one self-referencing node type

- **Decision**: One `CategoryNode` entity with a nullable parent. A node with no parent is a group; a node with a parent is a category. The parent can be a group or another category.
- **Rationale**: The spec gives groups and categories the same properties (name plus an ordered list of categories) and allows unlimited category nesting. One shape avoids duplicate code, and "groups cannot have parents" and "categories must have a parent" become a single rule: parent absent or present.
- **Alternatives considered**: Separate `Group` and `Category` tables (duplicates logic, and "parent is a group or a category" needs a polymorphic reference); materialized path or nested sets (unneeded at personal-finance scale).

## Decision 2: Ordering by a per-parent position number

- **Decision**: Each node stores an integer `Position`, unique within `(OwnerUserId, ParentId)`. New nodes get max sibling position + 1. Rename never changes it. Deleting leaves gaps, which is harmless because only relative order matters.
- **Rationale**: Satisfies "new items go to the bottom" and "no reordering", and keeps order stable across sessions (FR-013). A unique index on the sibling scope guards against two concurrent creates getting the same position; the service retries once on conflict.
- **Alternatives considered**: Order by creation timestamp (ties and clock skew); a single global counter (works, but does not express per-parent lists).

## Decision 3: Case-insensitive sibling-name uniqueness enforced in service and database

- **Decision**: The service checks for sibling name collisions and returns a typed error. A unique index on `(OwnerUserId, ParentId, Name)` backs it. SQL Server's default case-insensitive collation gives the case-insensitive match. Because a NULL `ParentId` (groups) is treated as equal by SQL Server unique indexes, the group scope is also covered.
- **Rationale**: Clarified rule: no duplicate sibling names, case-insensitive. Server-side enforcement is required by the constitution. The index stops races.
- **Alternatives considered**: Client-only check (not allowed by Principle V); service-only check (race-prone).

## Decision 4: Subtree deletion performed in the service

- **Decision**: Delete loads the owner's nodes, collects the target and all descendants in memory, and removes them in one `SaveChanges`. The foreign key from parent is `NoAction`. A separate preview request returns how many items would be removed, for the warning prompt.
- **Rationale**: SQL Server forbids cascading delete on a self-referencing foreign key. Per-owner node counts are small, so one query is enough and no round trips repeat per level.
- **Alternatives considered**: Recursive CTE raw SQL (prohibited: all database access through EF Core); `ClientCascade` (still loads the nodes, so no simpler).

## Decision 5: Authorization and delivery of the tree

- **Decision**: All node endpoints require authorization and filter by the signed-in user's id, as Accounts do. The tree is delivered as one flat list ordered by depth-first display order. The client derives indentation from a `depth` value in each item, which also feeds the parent dropdown.
- **Rationale**: One request serves both the list and the dropdown. Depth-first ordering computed on the server keeps the display order testable in one place.
- **Alternatives considered**: Nested JSON (harder to bind to a flat dropdown); client-side sorting (duplicates order logic).

## Decision 6: Navigation

- **Decision**: Add a header navigation of "Accounts" and "Categories" buttons (no anchors, pointer cursor) that switches between the two top-level screens. Accounts stays the default.
- **Rationale**: The app currently has no top-level navigation; "at the same level as Accounts" needs one. The constitution requires buttons for navigation.
- **Alternatives considered**: Introducing a router (a new dependency and unrequested change).

## Decision 7: Theme, accessibility, and UI primitives

- **Decision**: Use existing semantic theme tokens, so both light and dark themes work and no new theme behavior is added (the existing persisted selector applies). Group names use a larger heading-style size, categories a smaller size with left indentation by depth, and a vertical gap separates groups. Use existing shadcn/ui primitives in `src/components/ui` where suitable, and the native select for the parent dropdown. Delete confirmation uses an accessible modal dialog.
- **Rationale**: Meets WCAG 2.2 AA keyboard and role/name expectations and stays within current dependencies.
- **Alternatives considered**: Custom tree widget (unneeded; no reordering or expansion in scope).
