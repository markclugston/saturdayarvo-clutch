---
paths:
  - "src/clutch-web/**/*.tsx"
  - "src/clutch-web/**/*.css"
  - "src/clutch-web/index.html"
---
# WEB-001 UI design

Load the `clutch-ui-style` skill and only the style guide sections this change needs. The design system is in code: tokens in `src/index.css`, primitives in `src/components/ui/`, and class rules enforced by the `clutch/style-tokens` lint rule. Reuse primitives, and fix lint findings rather than suppressing them.

Every list or table follows style guide §12: the headers, row lines, scrolling, styling and edit and remove buttons of the Assets list. Do not deviate unless the user has explicitly approved that deviation.
