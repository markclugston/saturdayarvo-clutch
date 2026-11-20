# Contract: Design tokens (`src/clutch-web/src/index.css`)

These are the only colour, radius and shadow utilities screens may use. Values are RGB channels (R1). Light values go on `:root`, and Soft Dark values go on `.dark` (R2).

## Surfaces and text

| Utility suffix | CSS variable | Light | Soft Dark |
|---|---|---|---|
| `canvas` | `--surface-canvas` | #FFFFFF | #1E1E1E |
| `content` | `--surface-content` | #F5F5F7 | #252526 |
| `card` | `--surface-card` | #FFFFFF | #2D2D30 |
| `raised` | `--surface-raised` | #F0F1F3 | #36363A |
| `hover` | `--surface-hover` | #EBECEF | #3C3C41 |
| `selected` | `--surface-selected` | #E8EEFC | #26354D |
| `fg` | `--fg` | #111318 | #D4D4D4 |
| `fg-secondary` | `--fg-secondary` | **#5F6673** | **#ABABB1** |
| `fg-muted` (disabled and decorative only) | `--fg-muted` | #9CA3AF | #75757B |
| `primary` | `--primary` | **#1A5FE6** | **#7EAEFF** |
| `primary-contrast` | `--primary-contrast` | #FFFFFF | **#0B1220** |
| `primary-tint` | `--primary-tint` | #E8EEFC | *#26354D* |
| `neutral-strong` | `--neutral-strong` | #14161B | *#36363A* |
| `neutral-strong-contrast` | `--neutral-strong-contrast` | *#FFFFFF* | *#D4D4D4* |
| `accent-navy` | `--accent-navy` | #1B2433 | *#8AB4FF* |
| `scrim` (dialog backdrop only) | `--scrim` | *#111318* | *#0E0E10* |

Values in **bold** differ from the guide reference (research R4). Values in *italics* are not in the guide reference (deviation D1). `scrim` is added so the dialog backdrop darkens the page in both themes (`bg-fg/35` would lighten it in Soft Dark). The dialog and startup backdrops use `bg-scrim/40` in both themes. Soft Dark `scrim` is near-black rather than `#000000`, so it stays within FR-009 and the T037 check.

`selected` is used for selected rows and items inside cards. The current navigation item uses `primary` / `primary-contrast` instead (D6), because `selected` is under 3:1 against `canvas`.

## Status (chip background and text)

Utilities are `bg-{status}-bg` and `text-{status}`, where status is one of `danger`, `warning`, `success`, `info` or `neutral`. `text-{status}` is also used for status text outside a chip (for example `ErrorMessage` uses `text-danger` on `card`).

| Status | Light background | Light text | Dark background | Dark text |
|---|---|---|---|---|
| danger | #FDECEC | **#C5221F** | #493D3E | **#F59C94** |
| warning | #FFF1E0 | **#9A5B00** | #4A4136 | #FBBF5A |
| success | #E6F6EC | **#167A45** | #36443F | #6FD39B |
| info | #E6F0FF | **#1D4ED8** | #3A404D | #8AB4FF |
| neutral | #EDEEF1 | #4B5563 | #424346 | #C4C7CE |

Dark chip backgrounds are the Dark text colour at 14% over `card` #2D2D30, stored as opaque channels (the guide describes a translucent background; D1) so that chips look the same on any surface and T005a can measure them directly. T005a re-checks the contrast; if a pair fails, fix it here.

## Solid actions

| Utility suffix | CSS variable | Light | Soft Dark |
|---|---|---|---|
| `danger-solid` | `--danger-solid` | #C5221F | #493D3E |
| `danger-solid-contrast` | `--danger-solid-contrast` | #FFFFFF | #F59C94 |
| `secondary-solid` | `--secondary-solid` | #14161B | #36363A |
| `secondary-solid-contrast` | `--secondary-solid-contrast` | #FFFFFF | #D4D4D4 |

The danger button uses `bg-danger-solid text-danger-solid-contrast` and the secondary button uses `bg-secondary-solid text-secondary-solid-contrast` in both themes, with no `dark:` variant (the lint rule forbids colour `dark:` variants). §5 asks for `neutral-strong` in Light and `raised` in Dark for secondary buttons; this pair encodes that. Light danger is 5.80:1, Dark danger 4.98:1, Light secondary 18.10:1, Dark secondary 8.12:1. These tokens are not in the guide reference (deviation D1).

## Contrast pairs checked by T005a

In both themes, at least 4.5:1:
- `fg` and `fg-secondary` on `canvas`, `content`, `card`, `raised`, `hover` and `selected`.
- `primary` (as text) on `canvas`, `content`, `card`, `raised` and `hover`.
- Each `text-{status}` on `{status}-bg`, `card` and `raised`.
- `primary-contrast` on `primary`, `danger-solid-contrast` on `danger-solid`, `secondary-solid-contrast` on `secondary-solid`, `neutral-strong-contrast` on `neutral-strong`.

In both themes, at least 3:1:
- `primary` (focus ring and current nav fill) against `canvas`, `content`, `card` and `raised`.

## Chart series

`chart-primary`, `chart-tint` and `chart-navy` map to `primary`, `primary-tint` and `accent-navy`. They are defined but not used (spec Assumptions).

## Radius, shadow and utilities

| Name | Value |
|---|---|
| `rounded-chip` | 6px |
| `rounded-control` | 10px |
| `rounded-card` | 16px |
| `rounded-panel` | 22px |
| `rounded-full` | avatars and pills only |
| `shadow-float` | `0 8px 30px rgb(0 0 0 / 0.12)` (Light), `0 8px 30px rgb(0 0 0 / 0.40)` (Dark) |
| `focus-ring` (`@utility`) | `outline: 2px solid rgb(var(--primary)); outline-offset: 2px` (D5) |
| `hairline-t`, `hairline-b` (`@utility`) | 1px border in `fg` at 7% opacity |

Base rules: `body` uses `bg-canvas text-fg text-sm` (14px body, §7); `button` keeps `cursor-pointer`. Global rule: `@media (prefers-reduced-motion: reduce)` sets transition and animation durations to `0.01ms`.
