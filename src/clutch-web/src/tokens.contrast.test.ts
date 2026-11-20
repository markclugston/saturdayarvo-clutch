import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

type Rgb = [number, number, number]

function readBlock(selector: ':root' | '.dark'): Record<string, Rgb> {
  const start = css.indexOf(`\n${selector} {`)
  expect(start, `${selector} block exists in index.css`).toBeGreaterThanOrEqual(0)
  const end = css.indexOf('\n}', start)
  const block = css.slice(start, end)
  const tokens: Record<string, Rgb> = {}
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*;/g)) {
    tokens[match[1] ?? ''] = [Number(match[2]), Number(match[3]), Number(match[4])]
  }
  return tokens
}

function luminance([r, g, b]: Rgb): number {
  const linear = (channel: number) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const surfaces = ['canvas', 'content', 'card', 'raised', 'hover', 'selected'] as const
const statuses = ['danger', 'warning', 'success', 'info', 'neutral'] as const
const textSurfaces = ['canvas', 'content', 'card', 'raised', 'hover'] as const

describe.each([
  ['Light', ':root'],
  ['Soft Dark', '.dark'],
] as const)('%s token contrast', (_name, selector) => {
  const t = readBlock(selector)
  const get = (name: string): Rgb => {
    const value = t[name]
    expect(value, `--${name} is defined`).toBeDefined()
    return value as Rgb
  }
  const surface = (name: string) => get(`surface-${name}`)

  it.each(surfaces)('fg and fg-secondary reach 4.5:1 on %s', (name) => {
    expect(contrast(get('fg'), surface(name))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(get('fg-secondary'), surface(name))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(textSurfaces)('primary text reaches 4.5:1 on %s', (name) => {
    expect(contrast(get('primary'), surface(name))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(statuses)('%s text reaches 4.5:1 on its chip, card and raised', (status) => {
    const text = get(`status-${status}`)
    expect(contrast(text, get(`status-${status}-bg`))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(text, surface('card'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(text, surface('raised'))).toBeGreaterThanOrEqual(4.5)
  })

  it('solid action pairs reach 4.5:1', () => {
    expect(contrast(get('primary-contrast'), get('primary'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(get('danger-solid-contrast'), get('danger-solid'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(get('secondary-solid-contrast'), get('secondary-solid'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(get('neutral-strong-contrast'), get('neutral-strong'))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['canvas', 'content', 'card', 'raised'] as const)(
    'primary focus ring and current nav fill reach 3:1 against %s',
    (name) => {
      expect(contrast(get('primary'), surface(name))).toBeGreaterThanOrEqual(3)
    },
  )
})
