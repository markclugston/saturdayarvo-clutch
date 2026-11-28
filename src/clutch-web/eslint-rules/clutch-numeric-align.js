// clutch/numeric-align: numbers and currency amounts are right aligned (WEB-001).
// Flags a table cell showing a formatted amount, or a raw numeric input, that is not right aligned.
// FloatingField right aligns numeric inputs itself, so it needs no check.

const FORMATTERS = new Set(['formatCurrencyAmount', 'formatCurrency', 'formatPercent'])
// The list primitives (components/ui/list.tsx) are cells too; their `numeric` prop right aligns them.
const LIST_CELLS = new Set(['ListCell', 'ListHeaderCell'])
const CELLS = new Set(['td', 'th', ...LIST_CELLS])
const NUMERIC_INPUT_MODES = new Set(['numeric', 'decimal'])
const RIGHT = /(^|[\s"'`])(text-right|text-end|justify-end)(?=[\s"'`]|$)/

function attribute(node, name) {
  return node.attributes.find((item) => item.type === 'JSXAttribute' && item.name.name === name)
}

function literalValue(attr) {
  if (!attr || !attr.value) return undefined
  if (attr.value.type === 'Literal') return attr.value.value
  if (attr.value.type === 'JSXExpressionContainer' && attr.value.expression.type === 'Literal') {
    return attr.value.expression.value
  }
  return undefined
}

function callsFormatter(node) {
  if (!node || typeof node !== 'object') return false
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && FORMATTERS.has(node.callee.name)) {
    return true
  }
  return Object.entries(node).some(([key, child]) => {
    if (key === 'parent' || key === 'loc' || key === 'range') return false
    if (Array.isArray(child)) return child.some(callsFormatter)
    return child && typeof child === 'object' && typeof child.type === 'string' && callsFormatter(child)
  })
}

export const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require numbers and currency amounts to be right aligned' },
    schema: [],
    messages: {
      cell: 'Style guide: a cell showing a number or currency amount must be right aligned (text-right). See clutch-ui-style.',
      input: 'Style guide: a numeric input must be right aligned (text-right). Prefer FloatingField, which does it. See clutch-ui-style.',
    },
  },
  create(context) {
    const source = context.sourceCode
    const rightAligned = (opening) => {
      const numeric = LIST_CELLS.has(opening.name.name) ? attribute(opening, 'numeric') : undefined
      if (numeric && literalValue(numeric) !== false) return true
      const attr = attribute(opening, 'className')
      return Boolean(attr) && RIGHT.test(source.getText(attr))
    }
    return {
      JSXElement(node) {
        const opening = node.openingElement
        if (opening.name.type !== 'JSXIdentifier' || !CELLS.has(opening.name.name)) return
        if (node.children.some(callsFormatter) && !rightAligned(opening)) {
          context.report({ node: opening, messageId: 'cell' })
        }
      },
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'input') return
        const numeric = literalValue(attribute(node, 'type')) === 'number'
          || NUMERIC_INPUT_MODES.has(literalValue(attribute(node, 'inputMode')))
        if (numeric && !rightAligned(node)) context.report({ node, messageId: 'input' })
      },
    }
  },
}

export default rule
