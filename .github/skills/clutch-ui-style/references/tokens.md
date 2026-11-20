# Colour tokens (style guide §6)

Define as CSS custom properties holding **space-separated RGB channels** so Tailwind opacity modifiers work (e.g. `--surface-card: 255 255 255;`). Hex below is for reference; `src/clutch-web/src/index.css` wins on disagreement.

## 6.1 Light theme

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#FFFFFF` | Shell and navigation |
| `content` | `#F5F5F7` | Inset content panel |
| `card` | `#FFFFFF` | Cards and sections |
| `raised` | `#F0F1F3` | Inputs, chips, icon buttons, hatch |
| `hover` | `#EBECEF` | Hover fill |
| `selected` | `#E8EEFC` | Selected item tint |
| `fg` | `#111318` | Primary text |
| `fg-secondary` | `#5F6673` | Secondary text (AA on every surface; guide value `#6B7280` failed) |
| `fg-muted` | `#9CA3AF` | Disabled text and decorative icons only (below AA, never readable text) |
| `primary` | `#1A5FE6` | Brand and primary actions (guide value `#1F6BFF` failed as text) |
| `primary-contrast` | `#FFFFFF` | Text on primary |
| `primary-tint` | `#E8EEFC` | Light primary background |
| `neutral-strong` | `#14161B` | Secondary buttons, tooltips, dark chart series |
| `neutral-strong-contrast` | `#FFFFFF` | Text on `neutral-strong` |
| `accent-navy` | `#1B2433` | Chart contrast series |
| `scrim` | `#111318` | Dialog backdrop (`bg-scrim/40`) |
| `danger-solid` / `danger-solid-contrast` | `#C5221F` / `#FFFFFF` | Danger button |
| `secondary-solid` / `secondary-solid-contrast` | `#14161B` / `#FFFFFF` | Secondary button |

Status chips (background / text):

| Status | Background | Text |
|---|---|---|
| Danger / Urgent | `#FDECEC` | `#C5221F` |
| Warning / Medium / On Review | `#FFF1E0` | `#9A5B00` |
| Success / Complete | `#E6F6EC` | `#167A45` |
| Info / Low | `#E6F0FF` | `#1D4ED8` |
| Neutral / Tag | `#EDEEF1` | `#4B5563` |

## 6.2 Soft Dark theme

Dark but not black. Aim for VS Code Dark / Claude Desktop: charcoal, low glare, layering by lightening.

- MUST NOT use `#000` for any surface or `#FFF` for text.
- The darkest surface is `#1E1E1E` or lighter. Maximum text brightness is `#ECECEC`.
- Elevation is expressed by a lighter surface, not by shadow.

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#1E1E1E` | Shell and navigation |
| `content` | `#252526` | Content panel |
| `card` | `#2D2D30` | Cards |
| `raised` | `#36363A` | Inputs, chips |
| `hover` | `#3C3C41` | Hover fill |
| `selected` | `#26354D` | Selected tint (primary-tinted) |
| `fg` | `#D4D4D4` | Primary text |
| `fg-secondary` | `#ABABB1` | Secondary text (AA on `hover`) |
| `fg-muted` | `#75757B` | Muted text |
| `primary` | `#7EAEFF` | Lifted so text on `hover` passes AA |
| `primary-contrast` | `#0B1220` | Text on primary (white is 3.2:1) |
| `primary-tint` | `#26354D` | Light primary background |
| `neutral-strong` / `neutral-strong-contrast` | `#36363A` / `#D4D4D4` | Secondary buttons and tooltips |
| `accent-navy` | `#8AB4FF` | Chart contrast series |
| `scrim` | `#0E0E10` | Dialog backdrop |
| `danger-solid` / `danger-solid-contrast` | `#493D3E` / `#F59C94` | Danger button |
| `secondary-solid` / `secondary-solid-contrast` | `#36363A` / `#D4D4D4` | Secondary button |

Status chips: an opaque background equal to the status text colour at about 14% over `card`, so chips look the same on any surface and contrast is measurable, with a lightened text variant of the same hue.

| Status | Background | Text |
|---|---|---|
| Danger | `#493D3E` | `#F59C94` |
| Warning | `#4A4136` | `#FBBF5A` |
| Success | `#36443F` | `#6FD39B` |
| Info | `#3A404D` | `#8AB4FF` |
| Neutral | `#424346` | `#C4C7CE` |

A slight warm tint (Claude Desktop style) is an acceptable variation only if applied consistently to every neutral token.
