# Copilot Instructions

Spec Kit workflow is mandatory. Outside Spec Kit commands, read `.specify/memory/constitution.md` before planning or reviewing changes. Constitutional violations are CRITICAL. Each constitution heading names the `clutch-*` skill that holds its detail.

The code is the source of truth. Use `docs/code-map.md` to find the file that answers a question instead of exploring the repository.

The Claude Code copies in `.claude/` are kept in sync. After editing a `clutch-*` skill or an instructions file, run `.\scripts\sync-agent-config.ps1 -From copilot`. Mirror any change to this file in `CLAUDE.md`.

Never edit `speckit-*` skills: they are generated. Change their Clutch rules in `presets/clutch/` and follow its README.

## Workspace operations

- Create, read, update and delete files inside this workspace without asking. Ask before touching anything outside it.
- Use the provided file tools. Use a script only when no tool can do the job, and say why before running it.
