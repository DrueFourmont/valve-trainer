/**
 * Whether the test affordances exist at all.
 *
 * This is a compile time constant, not a runtime check. In a production build
 * both sides are known false, so Rollup drops every guarded branch and the
 * dynamic import of IWER along with it, rather than shipping dead code that
 * merely declines to run. The e2e suite greps the production bundle to prove
 * that actually happened.
 */
export const devToolsEnabled = import.meta.env.DEV || import.meta.env.MODE === 'test'

/** Both hooks are opt in per page load, so normal dev is unaffected. */
export function wantsTestHooks(): boolean {
  return devToolsEnabled && new URLSearchParams(location.search).get('test') === '1'
}

export function wantsEmulatedHeadset(): boolean {
  return devToolsEnabled && new URLSearchParams(location.search).get('xr') === 'iwer'
}
