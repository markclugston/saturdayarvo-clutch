# Data Model: Categories and Groups

## CategoryNode

A group (no parent) or a category (has a parent). Both have a name and an ordered list of child categories.

| Field | Type | Rules |
|---|---|---|
| Id | GUID | Generated on create; stable identifier |
| OwnerUserId | text | Required; the signed-in user; every query filters on it (FR-013, single-user access) |
| ParentId | GUID, optional | Empty means group. Otherwise must reference an existing node owned by the same user |
| Name | text | Trimmed; 1 to 100 characters; not whitespace-only (FR-004) |
| Position | integer | Order among siblings, ascending; assigned as max sibling position + 1 on create; never changed by rename |

### Derived

- **IsGroup**: `ParentId` is empty.
- **Depth**: 0 for a group, parent depth + 1 for a category.
- **Children**: nodes whose `ParentId` equals this node's `Id`, ordered by `Position`.

## Constraints

- Unique `(OwnerUserId, ParentId, Name)`, case-insensitive. Applies to groups too, as they share an empty `ParentId` (FR-004a).
- Unique `(OwnerUserId, ParentId, Position)`.
- `ParentId` references `CategoryNode.Id` with no cascade; the service deletes subtrees explicitly.
- Index on `(OwnerUserId, ParentId)` for tree loading.

## Validation

- Create group: name valid, no sibling group with the same name.
- Create category: name valid, parent supplied and owned by the user, no sibling with the same name under that parent.
- Rename: name valid, no other sibling with the same name; position and parent unchanged.
- Delete: node owned by the user; removes the node and all descendants together.

## State transitions

Create → (rename)* → delete. No move and no reorder.

## Migration

Adds the `CategoryNodes` table only. No existing data changes. Rollback drops the table; it is empty at deployment, so no backfill is needed.
