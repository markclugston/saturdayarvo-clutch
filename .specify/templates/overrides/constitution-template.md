# [PROJECT_NAME] Constitution

**Version**: [CONSTITUTION_VERSION] | **Last Amended**: [LAST_AMENDED_DATE]

<!--
  Clutch override. This file loads on every Spec Kit step, so keep it lean:
  - Keep every requirement ID and its heading format: `## <ID> <Name> · \`<clutch-* skill(s)>\``.
  - One short binding statement per bullet. No rationale paragraphs, examples or how-to detail.
    State obligations, not mechanisms: no colours, tokens, classes, component styling or other
    implementation detail. The code is authoritative for implementation; process goes in the
    named clutch-* skill; rationale goes in assumptions.md.
  - Never drop or merge an existing requirement ID without an explicit instruction to do so.
  - Keep the Sync Impact Report to 10 lines or fewer. It is removed after review.
-->

## Governance
[GOVERNANCE_RULES]
<!-- Source of truth (code for implementation, constitution for obligations, specs for intent),
     precedence for obligations (constitution > clutch-* skills and path-scoped instructions > reference docs),
     conflicts must be raised, violations are CRITICAL, skill names in headings hold the detail,
     and clutch-constitution-check holds the procedure. -->

## [REQUIREMENT_ID] [REQUIREMENT_NAME] · `[REQUIREMENT_SKILLS]`
- [REQUIREMENT_RULE]
<!-- Repeat this section once per requirement ID (ARC, DOT, AUD, ENG, OPS, SEC, WEB …).
     Omit the `· skill` suffix only when no skill holds detail for that ID. -->

## Performance & Observability
- [PERFORMANCE_RULE]

## Workflow and Delivery Gates
- [WORKFLOW_RULE]
<!-- Mandatory Spec Kit commands, Constitution Check, required gate tasks, delivery gates. -->

## Amendments
[AMENDMENT_RULES]
