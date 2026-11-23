---
name: "clutch-analyze-fixall"
description: "Run speckit-analyze and fix every finding without asking, in up to 5 rounds, each analysis starting from fresh context. Stop when a round finds nothing above LOW. Use after task generation to analyze and remediate in one step."
metadata:
  author: "saturdayarvo-clutch"
  governs: "Spec Kit analysis remediation"
---

# Clutch Analyze and Fix All

Analyze the current feature with `speckit-analyze`, fix what it finds, and repeat until it is clean. This skill is your approval to edit: do not ask before fixing, and do not stop between rounds to check in.

## Rules

- **Maximum 5 rounds.** A round is one analysis plus the fixes for its findings.
- **Stop early** as soon as an analysis reports no findings, or only LOW findings. Do not fix the LOW findings from that final analysis; list them in the summary.
- **Fresh context for every analysis.** You cannot run `/clear` yourself, so get the same effect this way: run each analysis in a new `general-purpose` subagent that has not seen earlier rounds. Its prompt is: "Invoke the `speckit-analyze` skill for the current feature and return its full report: the findings table, the metrics and the Next Actions. Do not edit any files and do not offer remediation." Never give it earlier findings or say what was fixed.
- **Fix every finding of every severity** (CRITICAL, HIGH, MEDIUM and LOW) in the rounds that continue. Fix constitution (CRITICAL) findings first, then HIGH, MEDIUM, LOW.
- **Fix the artifacts, never the constitution.** Edit `spec.md`, `plan.md` or `tasks.md` to resolve a finding. If a finding can only be resolved by changing `.specify/memory/constitution.md`, do not change it: record it as unresolved and carry on.
- **Fix the cause, not the wording.** A fix must make the artifacts agree with each other. Do not delete a requirement, task or check just to make a finding disappear.
- **Do not reintroduce.** If a later round reports a finding that an earlier fix should have closed, fix it properly and note in that round's output that it came back.

## Procedure

For round N = 1 to 5:

1. Start a fresh subagent and run the analysis as described above.
2. If the report has no findings, or only LOW findings, stop the loop.
3. Otherwise apply a fix for every finding, editing the files directly.
4. Output the round's results (format below), then begin round N + 1 at once.

If round 5 still leaves findings above LOW, stop and report them as unresolved.

## Output

Print each round under its own heading as you finish it:

```
## Round N
Findings: X CRITICAL, Y HIGH, Z MEDIUM, W LOW

| ID | Severity | Location | Finding | Fix applied |
|----|----------|----------|---------|-------------|
```

End with a summary:

```
## Summary
Rounds run: N of 5
Stopped because: no findings | only LOW findings | 5-round limit reached
Fixes applied in total: count by severity, and the files changed
Remaining findings: table by severity, or "None"
Unresolved: findings needing a constitution change or human decision, or "None"
```
