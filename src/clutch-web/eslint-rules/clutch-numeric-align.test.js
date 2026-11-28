import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import { rule } from './clutch-numeric-align.js'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

tester.run('clutch/numeric-align', rule, {
  valid: [
    'const a = <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyAmount(x, c)}</td>',
    'const a = <td className="px-3 justify-end">{row.ok ? formatPercent(x) : ""}</td>',
    'const a = <td className="px-3">{row.description}</td>',
    'const a = <input className="text-right" inputMode="decimal" />',
    'const a = <input type="text" />',
    'const a = <FloatingField inputMode="numeric" />',
    'const a = <ListCell numeric>{formatCurrencyAmount(x, c)}</ListCell>',
    'const a = <ListHeaderCell className="text-right">{formatPercent(x)}</ListHeaderCell>',
    'const a = <ListCell>{row.description}</ListCell>',
  ],
  invalid: [
    { code: 'const a = <td className="px-3">{formatCurrencyAmount(x, c)}</td>', errors: [{ messageId: 'cell' }] },
    { code: 'const a = <td>{x == null ? "" : formatCurrency(x)}</td>', errors: [{ messageId: 'cell' }] },
    { code: 'const a = <th className="text-left">{formatPercent(x)}</th>', errors: [{ messageId: 'cell' }] },
    { code: 'const a = <input type="number" />', errors: [{ messageId: 'input' }] },
    { code: 'const a = <input inputMode="numeric" className="w-full" />', errors: [{ messageId: 'input' }] },
    { code: 'const a = <ListCell>{formatCurrencyAmount(x, c)}</ListCell>', errors: [{ messageId: 'cell' }] },
    { code: 'const a = <ListCell numeric={false}>{formatCurrency(x)}</ListCell>', errors: [{ messageId: 'cell' }] },
    { code: 'const a = <ListHeaderCell>{formatPercent(x)}</ListHeaderCell>', errors: [{ messageId: 'cell' }] },
  ],
})
