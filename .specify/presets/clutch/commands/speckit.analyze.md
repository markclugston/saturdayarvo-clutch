---
description: "Perform a non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md after task generation."
strategy: wrap
---

## Clutch Rules

These take precedence over any conflicting instruction below, including the read-only constraint, the findings limit, the report format and the remediation steps.

**Before the detection passes**, run `.\scripts\check-spec-artifacts.ps1`. It checks requirement coverage, task format and length, Constitution Check rows, gate tasks and placeholders. Do not repeat those checks by reading; report each of its ERROR lines as a finding. Warnings are not findings.

**Reporting bar**: report only CRITICAL and HIGH findings. A finding qualifies only if implement would build the wrong thing, miss a requirement, or break a constitution requirement, and its Summary says which. Do not report wording, style, terminology or duplication unless two statements contradict each other. List every qualifying finding in this one pass. No findings is a valid result. Report MEDIUM and LOW only if the user input asks for them.

**Report**: the findings table, then one line with the script result and the count of findings by severity. Output no coverage table, unmapped task list or other metrics. Make each Recommendation a concrete edit.

**Fix and re-check** (replaces "Offer Remediation"): with no findings, say the feature is ready for `/speckit-implement` and stop. Otherwise ask once: "Apply all fixes?" Change no file before approval. On approval, in this same session:

1. Apply the fixes as one batch. Change each fact only in the file that owns it: behaviour and rules in `spec.md`, fields and constraints in `data-model.md`, API and UI shapes in `contracts/`, decisions in `research.md`. Elsewhere cite the ID or file instead of repeating the text.
2. Run the check script again.
3. Re-check **only** the findings just fixed and the lines just edited. Do not run a new analysis or raise unrelated findings.
4. If the re-check fails, fix and re-check once more. Then stop, list what remains and let the user decide. CRITICAL findings must be resolved before `/speckit-implement`.

Do not suggest another `/speckit-analyze` run unless a requirement changed.

{CORE_TEMPLATE}
