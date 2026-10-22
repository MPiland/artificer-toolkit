/**
 * Makes Vitest import workspace packages from `src` through their `source` export condition, so a
 * test run needs no `dist` build. tsc and production builds never set the condition and keep
 * resolving `dist`. Spread it into a Vitest config; `test.server.deps.inline` keeps the packages
 * transformed instead of loaded by Node, which cannot read their TypeScript.
 */
export const sourceResolve = {
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } }
}

export const inlineWorkspacePackages = [/@artificer-toolkit[\\/]/]
