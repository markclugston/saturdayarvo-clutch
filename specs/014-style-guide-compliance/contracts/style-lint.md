# Contract: `clutch/style-tokens` ESLint rule

- **Location**: `src/clutch-web/eslint-rules/clutch-style.js`, registered as a local plugin in `src/clutch-web/eslint.config.js`.
- **Files**: `src/**/*.{ts,tsx}` (every file, no exemptions).
- **Inspected strings**: string and template literals in JSX attributes named `className` or ending in `ClassName`; in the arguments of `cn(...)`, `cva(...)`, `clsx(...)` and `twMerge(...)` (including nested variant objects); and in initializers of variables whose names end in `Class`, `Classes` or `ClassName`.
- **Nested expressions**: within each inspected location, literals are collected recursively through conditional (`a ? 'x' : 'y'`) and logical (`&&`, `||`, `??`) expressions, array elements, object property **keys** (for `cn({ 'bg-x': cond })`), template-literal quasis, and the return expressions of arrow functions passed as `className` (Base UI state callbacks). Identifiers and calls to other functions are not followed.
- **Not inspected**: class strings outside those locations, for example in a plain object whose name does not end in `Class`/`Classes`/`ClassName` and that is not passed to a merge helper. Primitives use `cva`, so their variant strings are inspected.
- **Matching**: each literal is split on whitespace. Each class has its variant prefixes removed (everything up to the last `:` outside brackets, so arbitrary variants such as `[&_:focus-visible]:` are removed too) and an `!` important marker removed before matching.

| Pattern (after prefix strip) | Message id |
|---|---|
| `/\[#[0-9a-f]{3,8}\]/i`, `/(rgb\|hsl\|oklch\|color-mix)\(/` inside `[...]` | `rawColour` |
| `/^(bg\|text\|border\|ring\|outline\|fill\|stroke\|from\|to\|via\|decoration\|accent\|caret\|placeholder)-(white\|black)(\/\d+)?$/` and `/^(bg\|text\|border\|ring\|outline\|fill\|stroke\|from\|to\|via\|decoration\|accent\|caret\|placeholder)-(slate\|gray\|zinc\|neutral\|stone\|red\|orange\|amber\|yellow\|lime\|green\|emerald\|teal\|cyan\|sky\|blue\|indigo\|violet\|purple\|fuchsia\|pink\|rose)-\d+(\/\d+)?$/` (palette names require a shade, so the `neutral` status token `text-neutral` is allowed) | `defaultPalette` |
| Retired shadcn tokens: `/^(bg\|text\|border\|ring\|outline\|fill\|stroke)-(background\|foreground\|primary-foreground\|muted(-foreground)?\|accent(-foreground)?\|secondary(-foreground)?\|destructive(-foreground)?\|popover(-foreground)?\|card-foreground\|input\|border\|ring\|sidebar.*\|chart-\d+)(\/\d+)?$/` | `legacyToken` |
| Any class matching `/^rounded(-.*)?$/` that does not match the allow-list `/^rounded(-(t\|r\|b\|l\|s\|e\|tl\|tr\|bl\|br\|ss\|se\|es\|ee))?-(chip\|control\|card\|panel\|full)$/` | `radius` |
| `/^(border\|divide)(-.*)?$/` except `border-collapse`, `border-separate` and `border-spacing-*` | `border` (use `hairline-t` or `hairline-b`) |
| `/^ring(-.*)?$/`, `/^outline-(?!none$\|hidden$).*$/`, `/^outline$/` | `ring` (use `focus-ring`) |
| `/^shadow(-.*)?$/` except `shadow-float` | `shadow` |
| A class with a `dark:` prefix whose remainder is a colour utility: `bg\|text\|fill\|stroke\|from\|via\|to\|decoration\|accent\|caret\|placeholder` followed by a token or palette colour (not size or alignment values such as `text-sm` or `text-left`) | `darkColour` |
| Any `transition*` other than `transition-colors`, `transition-opacity`, `transition-transform`, `transition-[width]`, `transition-[opacity,transform]`, `transition-[color,transform]` or `transition-none` | `transition` (FR-012) |
| Any `duration-*` other than `duration-150`, `duration-200` or `duration-250` | `duration` (FR-012) |
| Any `ease-*` other than `ease-out` or `ease-in-out` | `easing` (FR-012) |

- **Allowed**: the tokens in [design-tokens.md](design-tokens.md), `focus-ring`, `hairline-t`, `hairline-b`, `shadow-float`, `outline-none` and `outline-hidden`.
- **Report format**: `Style guide: '<class>' is not allowed (<reason>). See clutch-ui-style.` at the literal's location.
- **Tests**: `eslint-rules/clutch-style.test.js` uses `RuleTester`. Because Vitest globals are off, it sets `RuleTester.describe = describe`, `RuleTester.it = it` and `RuleTester.itOnly = it.only` from `vitest`. It covers one valid and one invalid case for each message id, including:
  - a case in `components/ui/`;
  - `dark:` non-colour cases such as `dark:hidden` and `dark:text-sm` (valid);
  - `border-collapse` (valid) and `text-primary-foreground` (`legacyToken`);
  - `text-neutral` and `bg-neutral-bg` (valid), `bg-neutral-100` and `bg-white` (`defaultPalette`);
  - `transition-all`, `transition-shadow` and `transition-[height]` (`transition`), `transition-[opacity,transform]` and `transition-[color,transform]` (valid);
  - `duration-500` (`duration`) and `ease-linear` (`easing`);
  - `rounded`, `rounded-xs` and `rounded-[10px]` (`radius`), `rounded-t-card` (valid);
  - `[&_:focus-visible]:outline-2` (`ring`) and `[&_:focus-visible]:z-20` (valid);
  - class strings held in a `*Class` variable and a `*ClassName` prop;
  - nested literals: `className={x ? 'bg-white' : 'bg-card'}`, `cn({ 'border': c })` and `className={(s) => s.open ? 'shadow-lg' : ''}` are each invalid.
