# Research: Mortgages Screen

One entry per open decision. Settled behaviour (auth, ownership, ProblemDetails, audit table, data
fetching) follows the code and is not repeated.

## R1 Burn Down chart rendering

- **Decision**: Inline SVG component (`BurnDownChart.tsx`) drawing title, faint horizontal guides, a currency balance axis, a repayment-date axis, a "Bank schedule" legend and the "not yet calculated" message; `role="img"` with an `aria-label` text alternative.
- **Rationale**: No values exist yet (FR-013, FR-016); a skeleton needs no library. Avoids a new dependency and its security review.
- **Alternatives**: Recharts / Chart.js — rejected for now; the calculation feature can revisit when real series exist.

## R2 Save toast

- **Decision**: Base UI `Toast` (`@base-ui/react/toast`, already a dependency) wrapped as `components/ui/toast.tsx`; `role="status"` live region, 5 s timeout paused on hover/focus, close button, bottom-right (bottom-centre below 768 px), `shadow-float` raised surface.
- **Rationale**: Meets FR-015 accessibility and timing without a new package.
- **Alternatives**: sonner — new dependency; hand-rolled — reimplements pause/announce logic.

## R3 Schedule size and windowing

- **Decision**: Fixed-row-height windowed rendering inside the group's scroll container (in-house, ~40 lines), `role="table"` with `aria-rowcount` = N + 2 (header included) and `aria-rowindex` on rendered rows; sticky header.
- **Rationale**: Duration has no fixed limit; weekly from 1 Jan 0001 reaches ~522,000 rows, which is unusable as plain DOM.
- **Alternatives**: Render all rows — freezes the browser; `@tanstack/react-virtual` — new dependency for a simple fixed-height case.

## R4 Concurrency version

- **Decision**: `Mortgage.Version` (`int`) configured with `IsConcurrencyToken()`, incremented by the domain on every successful update. Clients send it on `PUT` (body) and `DELETE` (`?version=`). Mismatch or `DbUpdateConcurrencyException` → 409 `mortgage-changed`. Missing mortgage → 404.
- **Rationale**: Rate-change-only edits don't touch the parent row, so `rowversion` would not change; an explicit counter always moves.
- **Alternatives**: `rowversion` plus forced parent update — works but indirect; ETag/If-Match — no precedent in this API.

## R5 "Not later than today" on the server

- **Decision**: Screen checks against the user's local date. Server rejects a Drawdown date after `DateOnly.FromDateTime(timeProvider.GetUtcNow().AddHours(14).UtcDateTime)`, the latest date anywhere in the world (UTC+14), using an injected `TimeProvider`. (`UTC today + 1 day` is wrong: before 10:00 UTC it accepts a date that is still in the future everywhere.)
- **Rationale**: The server cannot trust a client-sent "today"; the bound never rejects a valid local date.
- **Alternatives**: Client-supplied time zone — untrusted input that still needs a bound.

## R6 20-mortgage limit and name uniqueness under concurrency

- **Decision**: Create runs count + duplicate check + insert in a `Serializable` EF Core transaction. Uniqueness also enforced by a unique index on `(OwnerUserId, Name)` (the column uses an explicit case-insensitive collation, `Latin1_General_100_CI_AS`, so this does not depend on the database default, and names are stored trimmed); a unique violation maps to the duplicate-name field error.
- **Rationale**: Two concurrent creates could otherwise reach 21 or duplicate a name.
- **Alternatives**: Check-only — racy; per-user counter row — extra table for one rule.

## R7 Error shape that separates field errors from clashes

- **Decision**: Validation (including duplicate name and limits) → 400 ProblemDetails with `errors` keyed by field path (`name`, `openingBalance`, `duration`, `drawdownDate`, `paymentFrequency`, `interestRateChanges`, `interestRateChanges[i].newInterestRate`, `interestRateChanges[i].effectiveDate`, `mortgages` for the 20-limit). 409 is reserved for version clashes.
- **Rationale**: The UI must tell "show next to field" (FR-008) from "changed elsewhere, Reload" (FR-021). Categories uses 409 for duplicates; here 409 already means a clash.
- **Alternatives**: 409 for both with a discriminator — harder to type on the client.

## R8 Numeric storage

- **Decision**: `OpeningBalance` `decimal(19,2)`; `NewInterestRate` `decimal(5,2)`; `Duration` `int`. Requests carry `duration` as a JSON number and the validator rejects values above the date bound (always far below `int.MaxValue`). Opening balance is capped at 999,999,999,999.99 (spec FR-007), well below 2⁵³ cents, so JSON and JS numbers keep every cent and values round-trip unchanged (SC-002).
- **Rationale**: "No upper limit" is bounded only by what can be stored; 19 digits matches existing money columns' width.
- **Alternatives**: `decimal(38,2)` — no realistic benefit.

## R9 Unsaved-changes guard

- **Decision**: `UnsavedChangesProvider` in `src/components/unsaved-changes/`, which also renders `DiscardChangesDialog`: the Mortgages page registers `isDirty`; App navigation, sign-out, tab switches, deleting another mortgage and Reload call `guard.run(action)`, which shows the discard-or-stay modal when dirty. While dirty, a `beforeunload` listener triggers the browser's own prompt. A 401 from any mortgage request opens the session-expired modal ("Stay on this page" / "Sign in again") only while dirty; Sign in again resets the session query as sign-out does. While clean (including on load), a 401 resets the session query directly, returning to the sign-in screen as `App.tsx` does for an expired session. While the guard is dirty, App's `['session']` query does not refetch on window focus or reconnect (`refetchOnWindowFocus: !isDirty`, `refetchOnReconnect: !isDirty`), so an expired sign-in is always found by a mortgage request and goes through the session-expired modal. It never unmounts the page directly.
- **Rationale**: FR-026 spans App-level actions owned outside the feature; state stays in memory only (no drafts).
- **Alternatives**: Router blockers — the app has no router.

## R10 Repayment-date arithmetic (shared rule)

- **Decision**: Final date = first + (N − 1) × 7 / 14 days, or `first.AddMonths(N − 1)` anchored on the first date (clamps to month end). Overflow past 31 Dec 9999 is detected arithmetically (day number / month index) before calling `DateOnly` APIs. Same rule mirrored in `features/mortgages/repaymentDates.ts` for on-screen checks, with shared test vectors.
- **Rationale**: FR-019 requires it for validation; server remains authoritative.
- **Alternatives**: Server-only — would hide range hints until save.
