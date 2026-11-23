# Data Model: Mortgage Area Chart

No stored data, schema, endpoint or audit change. The chart reads only what it reads today (023 schedule, 024 `ActualBalancePoint[]`). Below are the client-side view shapes this feature adds.

## PlottedDate (derived, memoised)

| Field | Type | Source |
|---|---|---|
| `date` | `yyyy-MM-dd` | Disbursal Date, then each `ScheduledPeriod.date` |
| `x` | number (viewBox units, 70–580, ascending) | existing date scale |
| `bankCents` | integer | Opening Balance at index 0, else `closingCents` |
| `actual` | `ActualBalancePoint \| undefined` | the point with the same date; never at index 0 |

Rules: same points as before (FR-001); `actual` undefined ⇒ label omits Actual Balance (FR-008).

## HoverState

`{ index: number; source: 'pointer' | 'keyboard' } | null` — `index` into PlottedDate[].

| Event | Transition |
|---|---|
| Pointer move over plot | `{ nearest(x), 'pointer' }` |
| Pointer leave plot | `null` if `source === 'pointer'`, else unchanged |
| Right / Home / Page Down when `null` | `{ 0, 'keyboard' }` |
| Left / End / Page Up when `null` | `{ last, 'keyboard' }` |
| Left / Right when shown | `index ∓/± 1`, clamped, `'keyboard'` |
| Home / End when shown | `0` / `last`, `'keyboard'` |
| Page Down / Up when shown | nearest to date ± 1 year, at least one step, clamped, `'keyboard'` |
| Escape, blur | `null` |
| Focus | unchanged (no label on focus) |
| Schedule or points change | `null` if `index` out of range |

## Announcement

`string` — set to the label text on keyboard transitions only; `''` on pointer transitions and when hidden.

## Chart tokens

Four colour tokens per theme — values and rationale in [research.md](research.md) R1.
