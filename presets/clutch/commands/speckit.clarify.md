---
description: "Identify underspecified areas in the current feature spec by asking up to 5 highly targeted clarification questions and encoding answers back into the spec."
strategy: wrap
---

## Clutch Rules

These take precedence over any conflicting instruction below.

- Before scanning, read "Settled decisions" in `docs/code-map.md`. Never ask about anything it settles.
- Never ask about anything in the spec's Out Of Scope section, or repeat a question answered under `## Clarifications`.
- Ask only where the answer changes stored data, user-visible behaviour or security. Look first for scenarios the description missed within the requested scope: failure, empty, boundary and conflicting actions.
- Recommend the option that adds the least scope. Start any option that adds a mechanism (table, endpoint, background job, protocol) with "Adds:" and name it. Offer "Out of scope" where possible, and record that choice under Out Of Scope.
- Five questions is a limit, not a target. When nothing qualifies, reply "No material questions remain" and stop. Tell the user another run is not needed.

{CORE_TEMPLATE}
