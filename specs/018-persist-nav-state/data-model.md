# Data Model: Remember Navigation Expanded State

## NavigationState (domain enum, `Domain/Preferences/NavigationState.cs`)

| Value | Meaning |
|---|---|
| `Unpinned` | Navigation starts compact; expands on hover (amended 2026-11-22). Default when no row exists. |
| `Pinned` | Navigation starts pinned open. |

## UserNavigationPreference (entity, table `UserNavigationPreferences`)

| Column | Type | Rules |
|---|---|---|
| `UserId` | nvarchar(450) | PK; FK → `AspNetUsers.Id`, `ON DELETE CASCADE` |
| `State` | varchar(16) | Required; stored as enum string; `CK_UserNavigationPreferences_State`: `[State] IN ('Pinned', 'Unpinned')` |
| `UpdatedAtUtc` | datetimeoffset | Required; set from `TimeProvider` on every save |

- One row per user (PK), created on first save, updated thereafter (upsert).
- No row → read returns `Unpinned`.
- Not an audit event (AUD-001 N/A); not personal or financial data.

## State transitions

```text
(no row) --PUT Pinned|Unpinned--> row(State, UpdatedAtUtc)
row      --PUT Pinned|Unpinned--> row(new State, new UpdatedAtUtc)   # last committed save wins
row      --user deleted--------> (cascade delete)
```

## Migration

- `AddNavigationPreferences`: creates the table, PK, FK and check constraint only.
- Rollback: `Down` drops the table. No backfill: existing users read `Unpinned` (current behaviour).

## Client state (clutch-web, not persisted locally)

| State | Source | Changes on |
|---|---|---|
| `pinned` | Seeded once per signed-in user from the settled preference query (`Unpinned` on error/timeout) | Hamburger toggle only; dropped on sign-out (signed-in shell, keyed by user ID, unmounts) |
| `hovered`, `hoverSuppressed` | Mouse pointer only (amended 2026-11-22), unchanged from 011/015 | Never saved |
