# Data Model: VS Code-Inspired Dark Theme

## Scope

This feature changes presentation tokens only. It adds no domain entities, API payloads, database fields, or persisted browser state.

## Theme State

| Attribute | Source | Behavior |
|---|---|---|
| System color preference | Browser `prefers-color-scheme` media query | Current source of theme selection; no app setting is introduced. |
| Active dark-mode marker | `document.documentElement.classList` | `ThemeProvider` adds `.dark` when the system preference is dark and tracks preference changes. |
| Persisted theme choice | None | No local/session storage or other preference persistence exists; this feature must not add or change it. |

### State transitions

- Initial render effect reads the current media-query match and sets the `.dark` class accordingly.
- A media-query change updates the class to reflect the new operating-system preference.
- Provider cleanup removes the media-query listener.

These are existing behaviors and are recorded as preservation constraints, not requested behavior changes.

## Semantic Theme Tokens

The existing CSS variables remain the source of truth. Only dark-mode values or directly related component styling are in scope; light-mode `:root` values remain unchanged.

| Role | Existing token family | Intended use |
|---|---|---|
| Main work surface | `background`, `foreground` | Page background and primary text. |
| Supporting surface | `card`, `card-foreground`, `popover`, `popover-foreground` | Cards, menus, dialogs, and floating content. |
| Secondary content | `muted`, `muted-foreground`, `secondary`, `secondary-foreground` | Subdued copy and secondary controls. |
| Navigation | `sidebar`, `sidebar-foreground`, `sidebar-accent`, `sidebar-border` | Navigation and related section states where used. |
| Separators and control outlines | `border`, `input`, `ring` | Meaningful boundaries and keyboard focus; check against actual adjacent surfaces. |
| Interactive accents | `primary`, `accent`, `destructive` and corresponding foreground tokens | Actions and statuses with readable labels and distinguishable non-color cues. |

## Validation Rules

- Normal text contrast is at least 4.5:1; large text contrast is at least 3:1.
- Meaningful non-text control/state indicators and boundaries meet the applicable 3:1 contrast requirement.
- Alpha colors are checked after compositing over their actual surfaces.
- Error, status, selected, disabled, and focus states remain identifiable without color as the sole cue.
