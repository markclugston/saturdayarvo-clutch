# Clutch Spec Kit Preset

Clutch rules for `speckit-specify`, `clarify`, `plan`, `tasks` and `analyze`. Each command file wraps the core Spec Kit command at `{CORE_TEMPLATE}`, with the Clutch rules first.

Edit the files here. Never edit `.claude/skills/speckit-*` or `.github/skills/speckit-*`: both are generated. `.specify/presets/` is the installed copy.

## After Editing This Preset

```powershell
specify preset update clutch --dev presets/clutch
```

Spec Kit now sees the regenerated skills as modified, and a plain upgrade would refuse to run. Record them (this overwrites any hand edits to Spec Kit's files):

```powershell
specify integration upgrade claude --force
```

```powershell
.\scripts\sync-agent-config.ps1 -From claude
```

## After Upgrading Spec Kit

```powershell
specify integration upgrade claude
```

```powershell
.\scripts\sync-agent-config.ps1 -From claude
```

Then review the diff. Check that the sections the rules name still exist in the core commands: "Phase 0" and "Phase 1" (plan), the detection passes and "Offer Remediation" (analyze).

`specify integration upgrade` refuses to overwrite files edited by hand. Move such edits into this preset before using `--force`.
