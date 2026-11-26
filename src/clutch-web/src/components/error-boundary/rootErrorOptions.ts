import type { RootOptions } from 'react-dom/client'

/**
 * React's default handlers print the raw error and component stack, which can carry sensitive values
 * (SEC-003). These print a fixed notice and ignore what they are given.
 */
export const rootErrorOptions: Pick<RootOptions, 'onCaughtError' | 'onRecoverableError' | 'onUncaughtError'> = {
  onCaughtError: () => console.error('Part of the page could not be displayed.'),
  onRecoverableError: () => console.warn('The page recovered from a display problem.'),
  onUncaughtError: () => console.error('Clutch stopped because of a display problem.'),
}
