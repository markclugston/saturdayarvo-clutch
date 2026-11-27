---
description: "Create or update the feature specification from a natural language feature description."
strategy: wrap
---

## Clutch Rules

These take precedence over any conflicting instruction below.

- Before creating anything, check that the description has an "Out of scope:" statement. If it does not, ask for it and wait; "none" is a valid answer. Never guess it.
- Record it in the spec's Out Of Scope section. Specify nothing listed there, and no mechanism the description did not ask for (ARC-001).
- Apply "Settled decisions" in `docs/code-map.md` as assumptions.

{CORE_TEMPLATE}
