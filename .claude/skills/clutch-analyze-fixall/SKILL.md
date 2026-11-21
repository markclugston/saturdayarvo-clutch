---
name: "clutch-analyze-fixall"
description: "Run speckit-analyze, then suggest concrete wording and apply fixes for all findings. Use after task generation to analyze and remediate in one step."
metadata:
  author: "saturdayarvo-clutch"
  governs: "Spec Kit analysis remediation"
---

# Clutch Analyze and Fix All

Invoke the `speckit-analyze` skill with exactly this text as its arguments:

```
suggest concrete wording and apply fixes for all findings
```

Then follow `speckit-analyze` as normal, treating the text above as the user's remediation request.
Do not ask whether to apply fixes; apply them for every finding, constitutional (CRITICAL) findings first.
