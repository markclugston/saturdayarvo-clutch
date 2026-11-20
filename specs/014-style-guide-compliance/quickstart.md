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

Run on 2026-11-20 from `src/clutch-web`.

| # | Result |
|---|---|
| 1 | `npx vitest run eslint-rules`: 60 of 60 RuleTester cases pass. |
| 2 | `npm run lint`: exit code 0. |
| 3 | A temporary `className="bg-white"` fails with `Style guide: 'bg-white' is not allowed (default palette colour, use a design token)`, naming the file and line. Reverted. |
| 4 | `npm run typecheck` passes. `npm test`: 30 files, 296 tests pass, including `tokens.contrast.test.ts` (42) and the new primitive tests. No behavioural assertion in an existing component test changed. |
| 5 | `STYLE_SCREENSHOTS=1 npx playwright test --config playwright.style-guide.config.ts`: 104 of 104 pass (23 states x 2 themes x 2 viewports, plus the extra assertions), twice in a row against the baselines. |
| 6 | Baselines written to `e2e/style-guide.spec.ts-snapshots/` and reviewed (spot-checked Light and Dark states). Screenshots allow a 2% pixel ratio because native select text differs slightly between runs, and the loading spinner is masked. |
| 7 | `navigation.spec.ts`, `startup.spec.ts` and `theme-selector.spec.ts`: all pass except "keeps the pane and content usable across viewports and themes", which also hangs on the unmodified code (the mock has no `import-status`, so "Choose CSV file" never enables). Per-journey configs: `active-import` 3 of 3, `transaction-delete` 13 of 14 on the first run (one keyboard-focus test failed once, then passed 12 of 12 on repeat) and `ownership` 2 of 2. Not run: the real-API specs in the default config that have no per-journey config (`accounts-import`, `admin-import-limits`, `import-settings`). |
| 8 | `npm run build` succeeds. `npm audit --omit=dev`: 0 vulnerabilities. |
| 9 | `/speckit-converge` appended T060 and T061 (Phase 9). T060: `admin-import-limits`, `import-settings` and `active-import` specs pass after one fix (buttons no longer force `whitespace-nowrap`, which overflowed the page at 320px); the real-API tests in those files are skipped without a test API. T061: account-list buttons documented as an exception in plan.md D3. Gates 1-8 were rerun after the fix and pass (style-guide suite 104 of 104). |

Changes to existing test files: the two `navigation.spec.ts` expectations that SC-004 allows (collapsed width 56px to 64px, and the expanded-nav-before-heading assertion removed). The Playwright configs also gained `reducedMotion: 'reduce'` so journeys do not depend on the new colour and width transitions.

### Security review (T058a)

Scope: the full diff, against OWASP Top 10 and `clutch-security-review`.

- **AuthPage**: `id`, `type`, `autoComplete`, `maxLength` and `required` on both fields are unchanged (the password field keeps `current-password` / `new-password`). Validation, submission and the sign-in flow are unchanged. The error text is the same server `detail` or `title` as before, rendered as React text (no HTML injection) and never logged.
- **No new sinks**: no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, storage or cookie access was added.
- **No new dependencies**: `package.json` and the lockfile are unchanged. `Tooltip` uses the existing `@base-ui/react`.
- **No backend, API, secret or data-handling change.**
- **Findings**: none.
