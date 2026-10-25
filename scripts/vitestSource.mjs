import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

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

/**
 * Swaps the installed-Systems tier lists for the tracer's, which also install the test-only System
 * (D195). The tracer has no character tier, so the character list stays dnd5e-only. Only test
 * projects set these aliases, so the tracer never reaches a build.
 */
export const tracerTierAliases = ['vocabulary', 'policy', 'encounter', 'runtime'].map((tier) => ({
  find: new RegExp(`^.*/systems/installedGameSystems/${tier}\\.js$`),
  replacement: resolve(root, `packages/rules-runtime/src/__tests__/tracer/installed/${tier}.ts`)
}))

/**
 * Points the shared barrels and rules-runtime at one source module each. The barrels re-export each
 * other in cycles, and Vitest's module runner only resolves such `export *` cycles when every importer
 * reaches a barrel through the same module id.
 */
export const workspaceSourceAliases = {
  '@artificer-toolkit/rules-runtime': resolve(root, 'packages/rules-runtime/src'),
  '#authored': resolve(root, 'packages/shared/src/barrels/authored/index.ts'),
  '#compilers': resolve(root, 'packages/shared/src/barrels/compilers/index.ts'),
  '#core': resolve(root, 'packages/shared/src/barrels/core/index.ts'),
  '#maps': resolve(root, 'packages/shared/src/barrels/maps/index.ts'),
  '#utils': resolve(root, 'packages/shared/src/utils/index.ts')
}
