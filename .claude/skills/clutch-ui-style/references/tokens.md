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
| `fg-secondary` | `#6B7280` | Secondary text |
| `fg-muted` | `#9CA3AF` | Muted text, resting labels |
| `primary` | `#1F6BFF` | Brand and primary actions |
| `primary-contrast` | `#FFFFFF` | Text on primary |
| `primary-tint` | `#E8EEFC` | Light primary background |
| `neutral-strong` | `#14161B` | Secondary buttons, dark chart series |
| `accent-navy` | `#1B2433` | Chart contrast series |

Status chips (background / text):

| Status | Background | Text |
|---|---|---|
| Danger / Urgent | `#FDECEC` | `#D93025` |
| Warning / Medium / On Review | `#FFF1E0` | `#D97706` |
| Success / Complete | `#E6F6EC` | `#1E9E5A` |
| Info / Low | `#E6F0FF` | `#2563EB` |
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
| `fg-secondary` | `#A0A0A6` | Secondary text |
| `fg-muted` | `#75757B` | Muted text |
| `primary` | `#4C8DFF` | Lifted for contrast |
| `primary-contrast` | `#0B1220` or `#FFFFFF` | Whichever passes AA |

Status chips: translucent background (12-16% alpha of the status colour) with a lightened text variant of the same hue.

A slight warm tint (Claude Desktop style) is an acceptable variation only if applied consistently to every neutral token.
