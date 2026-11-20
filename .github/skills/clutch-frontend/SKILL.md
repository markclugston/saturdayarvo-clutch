---
name: "clutch-frontend"
description: "Clutch React/TypeScript rules, frontend tests and quality gates (WEB-001). Use when planning, writing, testing or reviewing clutch-web code."
metadata:
  author: "saturdayarvo-clutch"
  governs: "WEB-001, ENG-001 (frontend)"
---

# Clutch Frontend

For visual design (tokens, layout, forms, themes, UI checklist) also load `clutch-ui-style`.

## React

- Use current stable React with function components and hooks.
- Class components are prohibited, except approved error-boundary scenarios.
- Do not derive render state through `useEffect`.
- Use dedicated server-state libraries for remote data.
- Stable keys are required for lists.
- `dangerouslySetInnerHTML` with untrusted content is prohibited.

## TypeScript

- TypeScript is required, with `strict` and `noUncheckedIndexedAccess` enabled.
- `any` is prohibited. `@ts-ignore` is prohibited. `@ts-expect-error` requires an explanation.
- Validate data crossing trust boundaries at runtime. Generated types do not replace runtime validation.
- Handle ProblemDetails (RFC 9457) responses as typed cases.

## Styling and components

- Tailwind utilities are required. Use theme tokens and the shared `cn` helper.
- Responsive layouts are encouraged.
- Navigation uses button controls.
- File-selection controls must be accessible buttons.
- shadcn/ui is the default primitive source. Third-party UI registries require an independent security review (see `clutch-security-review`).

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

1. Lint script (typescript-eslint, including the Tailwind token rules from `clutch-ui-style`)
2. Unit and component test script
3. Browser tests for affected critical journeys
4. Build script. If it already runs the TypeScript compiler, skip the separate typecheck.
5. Dependency audit: `npm audit --omit=dev`

Never paste passing test lists or full logs into the chat. After a fix, rerun only the gates whose
covered code changed, then report every result. Never report a gate as passed when it failed or
could not run.
