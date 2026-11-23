# Contract: Transaction Order

No new endpoints and no response shape changes. Changed behaviour of existing endpoints:

## Transactions list (`TransactionService.GetPageAsync`)

- Order: `TransactionDate` desc, then `Sequence` desc (latest of the day first) (FR-004).
- `nextCursor`: opaque base64url of `yyyy-MM-dd|<sequence>`; next page returns rows strictly after it in the
  order above (FR-005). Validation: ≤ 128 chars, valid base64url, decodes to exactly two `|`-separated parts, exact `yyyy-MM-dd`
  date, integer ≥ 1 with no sign, spaces or extra characters. Anything
  else, including pre-feature cursors, returns 400 with title "The transaction cursor is invalid.", detail
  "Request a page without a cursor and try again." (both unchanged), and field-level errors (SEC-004):

  ```json
  "errors": { "cursor": ["The page cursor is not valid. Request the first page without a cursor."] }
  ```

  The message never reveals the cursor's format, the failing check, types or stack details.
- `pageSize` outside 1..maximum keeps its existing 400 title "The page size is invalid." and detail, and adds
  field-level errors (SEC-004):

  ```json
  "errors": { "pageSize": ["Page size must be between 1 and <maximum>."] }
  ```
- Items unchanged: `id, transactionDate, description, amount, direction, balance`. `Sequence` is not exposed.

## Import review (create and resume responses)

- `rows` ordered by `sourceRowNumber` ascending (file order), including possible duplicates (FR-007).

## Import confirm

- Response unchanged. Saved transactions receive `Sequence` per research R2–R5: each date's rows in the
  import's chronological order, after any already-saved rows on that date.

## Period balances

- Response unchanged. The last balance of a date is the one with the highest `Sequence` (FR-006).
