# Copilot Instructions

Spec Kit workflow is mandatory. Spec Kit commands load `.specify/memory/constitution.md` themselves; outside them, read it before planning or reviewing changes. Constitutional violations are CRITICAL findings.

Requirement detail lives in the `clutch-*` skills in `.github/skills/`. Each constitution heading names the skill to load. Path-scoped instructions in `.github/instructions/` apply automatically by file pattern.

The code is the source of truth. Use `docs/code-map.md` to go straight to the file that answers a question instead of exploring the repository.

Keep Spec Kit artifacts concise: omit `research.md` when there are no open unknowns, keep contracts to the schema without extra prose, and keep `quickstart.md` to runnable validation steps.

When running builds and tests, show failures only. Never paste passing test lists or full logs into the chat. Follow the test cadence in the `clutch-dotnet-service` and `clutch-frontend` skills.

## Workspace operations

- Create, read, update and delete files inside this workspace without asking. Ask before touching anything outside it.
- Use the provided file tools. Use a script only when no tool can do the job, and say why before running it.
