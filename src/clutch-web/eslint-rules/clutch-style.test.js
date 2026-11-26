import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import { rule } from './clutch-style.js'

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

const jsx = (classes) => `const a = <div className="${classes}" />`
const invalid = (code, messageId, filename) => ({
  code,
  ...(filename ? { filename } : {}),
  errors: [{ messageId }],
})

tester.run('clutch/style-tokens', rule, {
  valid: [
    jsx('bg-card text-fg rounded-card p-3 hover:bg-hover focus-visible:focus-ring'),
    jsx('hairline-t hairline-b shadow-float outline-none outline-hidden'),
    jsx('text-neutral bg-neutral-bg text-sm text-left'),
    jsx('border-collapse border-separate border-spacing-2'),
    jsx('dark:hidden dark:text-sm'),
    jsx('rounded-t-card rounded-full rounded-control rounded-chip rounded-panel'),
    jsx('[&_:focus-visible]:z-20 [&_:focus-visible]:relative'),
    jsx('transition-colors transition-opacity transition-transform transition-none'),
    jsx('transition-[width] transition-[opacity,transform] transition-[color,transform]'),
    jsx('duration-150 duration-200 duration-250 ease-out ease-in-out'),
    jsx('peer-focus:[transform:translateY(-0.625rem)_scale(0.75)]'),
    jsx('bg-primary text-primary-contrast bg-danger-solid text-danger-solid-contrast accent-primary'),
    jsx('text-chart-schedule-start text-chart-schedule-mid text-chart-schedule-end'),
    jsx('text-chart-actual-start text-chart-actual-mid text-chart-actual-end'),
    jsx('text-chart-forecast-start text-chart-forecast-mid text-chart-forecast-end'),
    { code:'const label = "bg-white"', filename: 'src/x.tsx' },
    { code: 'const sizeClass = "bg-card"' },
    { code: 'const a = <div className="bg-card" />', filename: 'src/components/ui/card.tsx' },
    { code: 'const a = <div className={x ? "bg-card" : "bg-raised"} />' },
    { code: 'const a = <div className={`flex ${gap} bg-card`} />' },
  ],
  invalid: [
    invalid(jsx('bg-[#fff]'), 'rawColour'),
    invalid(jsx('text-[rgb(1,2,3)]'), 'rawColour'),
    invalid(jsx('bg-white'), 'defaultPalette'),
    invalid(jsx('bg-neutral-100'), 'defaultPalette'),
    invalid(jsx('hover:text-gray-500'), 'defaultPalette'),
    invalid(jsx('text-primary-foreground'), 'legacyToken'),
    invalid(jsx('bg-muted'), 'legacyToken'),
    invalid(jsx('border-input'), 'legacyToken'),
    invalid(jsx('rounded'), 'radius'),
    invalid(jsx('rounded-xs'), 'radius'),
    invalid(jsx('rounded-[10px]'), 'radius'),
    invalid(jsx('rounded-lg'), 'radius'),
    invalid(jsx('border'), 'border'),
    invalid(jsx('border-t'), 'border'),
    invalid(jsx('divide-y'), 'border'),
    invalid(jsx('ring-2'), 'ring'),
    invalid(jsx('outline-2'), 'ring'),
    invalid(jsx('outline'), 'ring'),
    invalid(jsx('[&_:focus-visible]:outline-2'), 'ring'),
    invalid(jsx('shadow-lg'), 'shadow'),
    invalid(jsx('shadow'), 'shadow'),
    invalid(jsx('dark:bg-card'), 'darkColour'),
    invalid(jsx('dark:text-fg'), 'darkColour'),
    invalid(jsx('dark:text-chart-schedule-start'), 'darkColour'),
    invalid(jsx('dark:text-chart-schedule-mid'), 'darkColour'),
    invalid(jsx('dark:text-chart-schedule-end'), 'darkColour'),
    invalid(jsx('dark:text-chart-actual-start'), 'darkColour'),
    invalid(jsx('dark:text-chart-actual-end'), 'darkColour'),
    invalid(jsx('dark:text-chart-forecast-start'), 'darkColour'),
    invalid(jsx('dark:text-chart-forecast-mid'), 'darkColour'),
    invalid(jsx('dark:text-chart-forecast-end'), 'darkColour'),
    invalid(jsx('transition-all'), 'transition'),
    invalid(jsx('transition-shadow'), 'transition'),
    invalid(jsx('transition-[height]'), 'transition'),
    invalid(jsx('transition'), 'transition'),
    invalid(jsx('duration-500'), 'duration'),
    invalid(jsx('ease-linear'), 'easing'),
    invalid(jsx('bg-white'), 'defaultPalette', 'src/components/ui/card.tsx'),
    invalid('const buttonClass = "bg-white"', 'defaultPalette'),
    invalid('const a = <Foo itemClassName="bg-white" />', 'defaultPalette'),
    invalid('const a = <div className={x ? "bg-white" : "bg-card"} />', 'defaultPalette'),
    invalid('const a = cn({ "border": c })', 'border'),
    invalid('const a = cn("p-3", { "bg-white": c })', 'defaultPalette'),
    invalid('const a = <div className={(s) => s.open ? "shadow-lg" : ""} />', 'shadow'),
    invalid('const a = <div className={(s) => { return "shadow-lg" }} />', 'shadow'),
    invalid('const a = cva("p-3", { variants: { v: { a: "rounded-lg" } } })', 'radius'),
    invalid('const a = <div className={`flex bg-white ${x}`} />', 'defaultPalette'),
    invalid('const a = <div className={[x, "bg-white"]} />', 'defaultPalette'),
    invalid('const a = <div className={x && "bg-white"} />', 'defaultPalette'),
    invalid('const a = <div className="bg-white!" />', 'defaultPalette'),
    {
      code: jsx('bg-white border'),
      errors: [{ messageId: 'defaultPalette' }, { messageId: 'border' }],
    },
  ],
})
