---
name: "clutch-frontend"
description: "Clutch React/TypeScript rules, frontend tests and quality gates (WEB-001). Use when planning, writing, testing or reviewing clutch-web code."
metadata:
  author: "saturdayarvo-clutch"
  governs: "WEB-001, ENG-001 (frontend)"
---

# Clutch Frontend

For visual design (tokens, layout, forms, themes, UI checklist) also load `clutch-ui-style`.

## Source of truth

The code defines the frontend conventions. Read it rather than restating it here; locations are
in `docs/code-map.md`.

| Concern | Authoritative implementation | Enforced by |
|---|---|---|
| Stack and versions, npm scripts | `src/clutch-web/package.json` | — |
| Compiler strictness | `src/clutch-web/tsconfig*.json` | `build` / `typecheck` scripts |
| `any`, `@ts-ignore`, `@ts-expect-error` without a description | `src/clutch-web/eslint.config.js` (typescript-eslint recommended) | `lint` script |
| Style tokens and class rules | `src/clutch-web/eslint-rules/clutch-style.js` | `lint` script |
| Data fetching and server state, API client, response validation, ProblemDetails handling | `src/clutch-web/src/lib/api/` and a sibling feature's `api.ts` and hooks | Component tests |
| Feature structure (components, `api.ts`, hooks, tests) | a sibling folder in `src/clutch-web/src/features/` | Review |
| UI primitives and variants | `src/clutch-web/src/components/ui/` | Component tests |
| % and $ entry fields | `src/clutch-web/src/features/mortgages/FormattedNumberField.tsx` and its tests | Component tests |

Follow the nearest sibling's pattern. If the code and this skill disagree, raise it; do not pick a side.

## Rules no tool enforces (review)

The lint config has no React plugin, so review these:

- Function components and hooks only. Class components are prohibited, except approved error boundaries.
- Do not derive render state through `useEffect`.
- Remote data goes through the established server-state pattern, never ad-hoc fetch-and-store state.
- Stable keys are required for lists.
- `dangerouslySetInnerHTML` with untrusted content is prohibited.
- Validate data crossing trust boundaries at runtime, as the API client does. Generated types do not replace runtime validation.
- Navigation and file-selection controls are accessible buttons.
- New primitives come from shadcn/ui on Base UI, remapped to the tokens. Third-party UI registries require an independent security review (`clutch-security-review`).
- % and $ entry controls reuse `FormattedNumberField` (WEB-001). Their component tests type and paste invalid characters, assert the field excludes them, then blur and assert the formatted text.

## Testing

- Unit and component tests are required. Test user-visible behaviour, not implementation details.
- Critical user journeys require browser-level tests.
- Accessibility (WCAG 2.2 AA) is verified with automated checks where possible.

## Test cadence

Run from the frontend folder using the scripts in its `package.json`; read them rather than
assuming names. Add quiet reporter flags (`--reporter=dot` for Vitest, `--reporter=line` for Playwright).

| When | Run |
|---|---|
| After each task | `npx vitest related <changed files> --run --reporter=dot` |
| End of each phase | The typecheck, lint and unit test scripts, once each |
| Completion | All quality gates below, once |

- Don't rerun a gate unless code it covers changed since it last passed.
- Browser tests, the production build and the dependency audit run at completion, not per task.
- Browser tests are slow. Run only the specs or per-journey Playwright configs the feature touches.

## Quality gates (CI and completion)

Quiet output, failures only:

1. Lint script (typescript-eslint and the `clutch/style-tokens` rule)
2. Unit and component test script
3. Browser tests for affected critical journeys
4. Build script. If it already runs the TypeScript compiler, skip the separate typecheck.
5. Dependency audit: `npm audit --omit=dev`

Never paste passing test lists or full logs into the chat. After a fix, rerun only the gates whose
covered code changed, then report every result. Never report a gate as passed when it failed or
could not run.
