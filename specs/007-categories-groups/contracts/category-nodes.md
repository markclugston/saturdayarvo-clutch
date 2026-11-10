# Contract: Category Nodes API

All endpoints require an authenticated user and act only on that user's nodes. A node belonging to another user is reported as not found. Errors use RFC 9457 `ProblemDetails`.

## Item shape

```json
{
  "id": "guid",
  "parentId": "guid | null",
  "name": "string",
  "depth": 0
}
```

`parentId` is null for a group. `depth` is 0 for a group and increases by one per level.

## GET /api/category-nodes

Returns all of the user's nodes as a flat array in display order: each group in position order, directly followed by its descendants depth-first, each level in position order.

- 200: array of items (empty array when none).

## POST /api/category-nodes

Request: `{ "name": "string", "parentId": "guid | null" }`. A null or absent `parentId` creates a group; otherwise a category.

- 201: the created item, placed last among its siblings.
- 400: name empty or whitespace-only, or longer than 100 characters.
- 404: `parentId` does not exist for this user.
- 409: a sibling already has this name (case-insensitive).

## PATCH /api/category-nodes/{id}

Request: `{ "name": "string" }`. Only the name changes.

- 200: the updated item.
- 400, 409: as above.
- 404: no such node for this user.

## GET /api/category-nodes/{id}/deletion-impact

- 200: `{ "itemCount": 1 }` where `itemCount` is the node plus all descendants. Used for the warning message.
- 404: no such node for this user.

## DELETE /api/category-nodes/{id}

Deletes the node and all its descendants.

- 204: deleted.
- 404: no such node for this user.

## Screen behavior contract (clutch-web)

- A "Categories" button in the header navigation opens the screen; an "Accounts" button returns to accounts. Both are buttons with pointer cursors.
- Group names render at a larger text size than category names; categories are indented by depth; a visible gap separates each group block.
- The create form has a name field and a parent dropdown. The dropdown's first option is "None (create a group)"; the rest list every group and category in display order with indentation. Creating a category requires a chosen parent; with no nodes, only the group option is available and the user sees a message that a group is needed first.
- Each item has Rename and Delete buttons. Delete opens a dialog stating that the item and all categories beneath it will be deleted, with the item count, and asks whether to continue; Cancel leaves everything unchanged.
- Empty state is shown when there are no groups.
- No drag handles, move, or reorder controls exist.
