// clutch/style-tokens: rejects class names the clutch-ui-style guide forbids.
// Contract: specs/014-style-guide-compliance/contracts/style-lint.md

const SIDES = '(t|r|b|l|s|e|tl|tr|bl|br|ss|se|es|ee)'
const COLOUR_PREFIX = '(bg|text|border|ring|outline|fill|stroke|from|to|via|decoration|accent|caret|placeholder)'
const PALETTE = '(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'
const DARK_COLOUR_PREFIX = '(bg|text|fill|stroke|from|via|to|decoration|accent|caret|placeholder)'
const TOKEN_COLOURS = [
  'canvas', 'content', 'card', 'raised', 'hover', 'selected',
  'fg', 'fg-secondary', 'fg-muted',
  'primary', 'primary-contrast', 'primary-tint',
  'neutral', 'neutral-bg', 'neutral-strong', 'neutral-strong-contrast',
  'accent-navy', 'scrim',
  'danger', 'danger-bg', 'danger-solid', 'danger-solid-contrast',
  'warning', 'warning-bg', 'success', 'success-bg', 'info', 'info-bg',
  'secondary-solid', 'secondary-solid-contrast',
  'chart-primary', 'chart-tint', 'chart-navy',
  'white', 'black', 'transparent', 'current', 'inherit',
].join('|')

const REASONS = {
  rawColour: 'raw colour value, use a design token',
  defaultPalette: 'default palette colour, use a design token',
  legacyToken: 'retired shadcn token, use a design token',
  radius: 'non-token radius, use rounded-chip, rounded-control, rounded-card, rounded-panel or rounded-full',
  border: 'no borders on layout containers, use hairline-t or hairline-b',
  ring: 'use focus-ring for focus indication',
  shadow: 'only shadow-float is allowed',
  darkColour: 'colour tokens switch by theme, do not use dark: for colour',
  transition: 'only colour, opacity, transform and width may transition',
  duration: 'transitions last 150, 200 or 250ms',
  easing: 'only ease-out and ease-in-out are allowed',
}

const ALLOWED_TRANSITIONS = new Set([
  'transition-colors',
  'transition-opacity',
  'transition-transform',
  'transition-[width]',
  'transition-[opacity,transform]',
  'transition-[color,transform]',
  'transition-none',
])

const CHECKS = [
  ['rawColour', (c) => /\[#[0-9a-f]{3,8}\]/i.test(c) || /\[[^\]]*(rgb|hsl|oklch|color-mix)\(/.test(c)],
  ['defaultPalette', (c) => new RegExp(`^${COLOUR_PREFIX}-(white|black)(/\\d+)?$`).test(c)
    || new RegExp(`^${COLOUR_PREFIX}-${PALETTE}-\\d+(/\\d+)?$`).test(c)],
  ['legacyToken', (c) => /^(bg|text|border|ring|outline|fill|stroke)-(background|foreground|primary-foreground|muted(-foreground)?|accent(-foreground)?|secondary(-foreground)?|destructive(-foreground)?|popover(-foreground)?|card-foreground|input|border|ring|sidebar.*|chart-\d+)(\/\d+)?$/.test(c)],
  ['radius', (c) => /^rounded(-.*)?$/.test(c)
    && !new RegExp(`^rounded(-${SIDES})?-(chip|control|card|panel|full)$`).test(c)],
  ['border', (c) => /^(border|divide)(-.*)?$/.test(c)
    && !/^border-(collapse|separate|spacing-.*)$/.test(c)],
  ['ring', (c) => /^ring(-.*)?$/.test(c) || /^outline-(?!none$|hidden$).*$/.test(c) || c === 'outline'],
  ['shadow', (c) => /^shadow(-.*)?$/.test(c) && c !== 'shadow-float'],
  ['transition', (c) => /^transition(-.*)?$/.test(c) && !ALLOWED_TRANSITIONS.has(c)],
  ['duration', (c) => /^duration-/.test(c) && !['duration-150', 'duration-200', 'duration-250'].includes(c)],
  ['easing', (c) => /^ease-/.test(c) && !['ease-out', 'ease-in-out'].includes(c)],
]

const DARK_COLOUR = new RegExp(
  `^${DARK_COLOUR_PREFIX}-(${TOKEN_COLOURS}|background|foreground|muted(-foreground)?|destructive|popover|`
  + `${PALETTE}-\\d+|\\[#.*\\])(/\\d+)?$`,
)

/** Splits `a:b:[x:y]:class` into its variants and the bare class, ignoring colons in brackets. */
function splitVariants(token) {
  const variants = []
  let depth = 0
  let start = 0
  for (let i = 0; i < token.length; i += 1) {
    const ch = token[i]
    if (ch === '[' || ch === '(') depth += 1
    else if (ch === ']' || ch === ')') depth -= 1
    else if (ch === ':' && depth === 0) {
      variants.push(token.slice(start, i))
      start = i + 1
    }
  }
  let base = token.slice(start)
  if (base.startsWith('!')) base = base.slice(1)
  if (base.endsWith('!')) base = base.slice(0, -1)
  return { variants, base }
}

function findViolation(token) {
  const { variants, base } = splitVariants(token)
  for (const [id, test] of CHECKS) {
    if (test(base)) return id
  }
  if (variants.includes('dark') && DARK_COLOUR.test(base)) return 'darkColour'
  return null
}

const CLASS_HELPERS = new Set(['cn', 'cva', 'clsx', 'twMerge'])
const CLASS_VARIABLE = /(Class|Classes|ClassName)$/

export const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject class names the Clutch style guide forbids' },
    schema: [],
    messages: Object.fromEntries(
      Object.entries(REASONS).map(([id, reason]) => [
        id,
        `Style guide: '{{className}}' is not allowed (${reason}). See clutch-ui-style.`,
      ]),
    ),
  },
  create(context) {
    function checkString(node, text, { skipFirst = false, skipLast = false } = {}) {
      const tokens = text.split(/\s+/).filter(Boolean)
      const startsWithSpace = /^\s/.test(text)
      const endsWithSpace = /\s$/.test(text)
      tokens.forEach((token, index) => {
        if (skipFirst && index === 0 && !startsWithSpace) return
        if (skipLast && index === tokens.length - 1 && !endsWithSpace) return
        const messageId = findViolation(token)
        if (messageId) context.report({ node, messageId, data: { className: token } })
      })
    }

    function collect(node, keys) {
      if (!node) return
      switch (node.type) {
        case 'Literal':
          if (typeof node.value === 'string') checkString(node, node.value)
          break
        case 'TemplateLiteral':
          node.quasis.forEach((quasi, index) => {
            checkString(quasi, quasi.value.cooked ?? '', {
              skipFirst: index > 0,
              skipLast: index < node.quasis.length - 1,
            })
          })
          node.expressions.forEach((expression) => collect(expression, keys))
          break
        case 'ConditionalExpression':
          collect(node.consequent, keys)
          collect(node.alternate, keys)
          break
        case 'LogicalExpression':
          collect(node.left, keys)
          collect(node.right, keys)
          break
        case 'ArrayExpression':
          node.elements.forEach((element) => collect(element, keys))
          break
        case 'ObjectExpression':
          node.properties.forEach((property) => {
            if (property.type !== 'Property') return
            if (keys && !property.computed && property.key.type === 'Literal') {
              collect(property.key, keys)
            }
            collect(property.value, keys)
          })
          break
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          if (node.body.type === 'BlockStatement') {
            node.body.body.forEach((statement) => {
              if (statement.type === 'ReturnStatement') collect(statement.argument, keys)
            })
          } else {
            collect(node.body, keys)
          }
          break
        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
        case 'TSNonNullExpression':
          collect(node.expression, keys)
          break
        case 'JSXExpressionContainer':
          collect(node.expression, keys)
          break
        default:
          break
      }
    }

    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') return
        const name = node.name.name
        if (name !== 'className' && !name.endsWith('ClassName')) return
        collect(node.value, true)
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || !CLASS_HELPERS.has(node.callee.name)) return
        const keys = node.callee.name !== 'cva'
        node.arguments.forEach((argument) => collect(argument, keys))
      },
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || !CLASS_VARIABLE.test(node.id.name)) return
        collect(node.init, true)
      },
    }
  },
}

export default { rules: { 'style-tokens': rule } }
