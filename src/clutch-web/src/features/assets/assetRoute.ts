/**
 * The Assets pages have their own URLs through the History API (029 research R1). The app has no
 * router: every other page stays plain state at `/`.
 */
export type AssetRoute =
  | { page: 'list' }
  | { page: 'new' }
  | { page: 'asset'; assetId: string }

/** Null when the path is not an Assets path. */
export function parseAssetRoute(pathname: string): AssetRoute | null {
  const match = /^\/assets(?:\/([^/]*))?$/.exec(pathname)
  if (!match) {
    return null
  }
  const segment = match[1] ?? ''
  if (segment === '') {
    return { page: 'list' }
  }
  if (segment === 'new') {
    return { page: 'new' }
  }
  return { page: 'asset', assetId: decode(segment) }
}

export function assetPath(route: AssetRoute): string {
  if (route.page === 'list') {
    return '/assets'
  }
  return route.page === 'new' ? '/assets/new' : `/assets/${encodeURIComponent(route.assetId)}`
}

export function pushPath(path: string): void {
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path)
  }
}

// An unreadable id is kept as typed: the server then answers that no such asset exists.
function decode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
