# Quickstart: Style Guide Compliance validation

Run every command from `src/clutch-web`. Prerequisites: run `npm ci`, and install the Playwright browsers with `npx playwright install chromium`.

| # | Proves | Command | Expected |
|---|---|---|---|
| 1 | Lint rule behaviour (US5) | `npx vitest run eslint-rules --reporter=dot` | All `RuleTester` cases pass |
| 2 | Zero violations across the frontend (SC-002) | `npm run lint` | Exit code 0 |
| 3 | The lint gate fails on a deviation (US5) | Add `bg-white` to any `className`, then run `npm run lint`, then revert | Fails with `Style guide: 'bg-white' is not allowed`, naming the file and line |
| 4 | Behaviour unchanged (FR-014, SC-004) and token contrast (FR-010) | `npm run typecheck` then `npm test -- --reporter=dot` | All pass, including `tokens.contrast.test.ts`; no behavioural assertions changed |
| 5 | Screenshots, axe, focus, surfaces and no horizontal scroll in both themes and both viewports (SC-001, SC-001a, SC-003) | `$env:STYLE_SCREENSHOTS='1'; npx playwright test --config playwright.style-guide.config.ts --reporter=line` (needs the baselines from row 6) | 23 states × 2 themes × 2 viewports pass, plus the extra assertions |
| 6 | One-off baseline creation (SC-004); review the new PNGs before committing | `$env:STYLE_SCREENSHOTS='1'; npx playwright test --config playwright.style-guide.config.ts --update-snapshots --reporter=line` | Baselines written to `e2e/style-guide.spec.ts-snapshots/` |
| 7 | Existing journeys unchanged (SC-004, SC-005) | `npx playwright test --reporter=line` (the default config ignores `style-guide.spec.ts`), then `playwright.active-import.config.ts`, `playwright.transaction-delete.config.ts` and `playwright.ownership.config.ts` | All pass; the only changed expectations are the two in `navigation.spec.ts` that SC-004 lists |
| 8 | Build and dependency audit | `npm run build` then `npm audit --omit=dev` | Build succeeds; no new vulnerabilities |
| 9 | Spec, plan and tasks converge with the code (constitution Workflow gate) | `/speckit-converge` | No outstanding tasks appended |

States and assertions are defined in [contracts/visual-states.md](contracts/visual-states.md). Token values are in [contracts/design-tokens.md](contracts/design-tokens.md).

## Results

Record the outcome of each row (T058) and the security review findings (T058a) here.
