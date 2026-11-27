---
description: "Create or update the feature specification from a natural language feature description."
strategy: wrap
---

## Clutch Rules

These take precedence over any conflicting instruction below.

- An "Out of scope:" statement in the description is optional. Do not ask for one. If present, record it in the spec's Out Of Scope section; if absent, write "None" there. Never guess exclusions.
- Specify nothing listed as out of scope, and no mechanism the description did not ask for (ARC-001).
- Apply "Settled decisions" in `docs/code-map.md` as assumptions.

{CORE_TEMPLATE}
