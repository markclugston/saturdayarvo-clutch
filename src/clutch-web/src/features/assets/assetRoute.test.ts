import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assetPath, parseAssetRoute, pushPath } from './assetRoute'

describe('parseAssetRoute', () => {
  it.each([
    ['/assets', { page: 'list' }],
    ['/assets/', { page: 'list' }],
    ['/assets/new', { page: 'new' }],
    ['/assets/0b7c', { page: 'asset', assetId: '0b7c' }],
    ['/assets/a%20b', { page: 'asset', assetId: 'a b' }],
  ])('reads %s', (path, route) => expect(parseAssetRoute(path)).toEqual(route))

  it.each(['/', '/mortgages', '/assetsx', '/assets/one/two'])(
    'ignores %s',
    (path) => expect(parseAssetRoute(path)).toBeNull(),
  )

  it('keeps a badly encoded id as text', () => {
    expect(parseAssetRoute('/assets/%E0%A4%A')).toEqual({ page: 'asset', assetId: '%E0%A4%A' })
  })
})

describe('assetPath', () => {
  it('writes each route', () => {
    expect(assetPath({ page: 'list' })).toBe('/assets')
    expect(assetPath({ page: 'new' })).toBe('/assets/new')
    expect(assetPath({ page: 'asset', assetId: 'a b' })).toBe('/assets/a%20b')
  })
})

describe('pushPath', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'))

  it('adds a history entry only when the path changes', () => {
    const push = vi.spyOn(window.history, 'pushState')

    pushPath('/assets')
    pushPath('/assets')

    expect(window.location.pathname).toBe('/assets')
    expect(push).toHaveBeenCalledTimes(1)
  })
})
