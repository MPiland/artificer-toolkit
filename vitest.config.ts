import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

import {
  inlineWorkspacePackages,
  sourceResolve,
  workspaceSourceAliases
} from './scripts/vitestSource.mjs'

const TRACER_TESTS = 'packages/rules-runtime/src/__tests__/tracer/**/*.test.ts'

/** Swaps an installed-Systems tier list for the tracer's, which adds the test-only System (D195). */
const tracerTier = (tier: string) => ({
  find: new RegExp(`^.*/systems/installedGameSystems/${tier}\\.js$`),
  replacement: fileURLToPath(
    new URL(`./packages/rules-runtime/src/__tests__/tracer/installed/${tier}.ts`, import.meta.url)
  )
})

export default defineConfig({
  ssr: sourceResolve.ssr,
  resolve: {
    ...sourceResolve.resolve,
    preserveSymlinks: true,
    alias: workspaceSourceAliases
  },
  test: {
    allowOnly: false,
    environment: 'node',
    pool: 'threads',
    server: { deps: { inline: inlineWorkspacePackages } },
    projects: [
      {
        extends: true,
        test: {
          name: 'packages',
          include: [
            'packages/design-system/src/__tests__/**/*.test.ts',
            'packages/emails/src/__tests__/**/*.test.ts?(x)',
            'packages/shared/src/__tests__/**/*.test.ts',
            'packages/schema/src/__tests__/**/*.test.ts',
            'packages/authoring/src/**/*.test.ts',
            'packages/source-data/src/**/*.test.ts',
            'packages/rules-runtime/src/**/*.test.ts',
            'packages/encounter-persistence/src/**/*.test.ts',
            'apps/apis/src/**/*.test.ts',
            'apps/session-worker/src/**/*.test.ts',
            'scripts/**/*.test.mjs'
          ],
          exclude: [...configDefaults.exclude, TRACER_TESTS]
        }
      },
      {
        // The second-System tracer (ADR 0023): the installed lists also install a test-only System.
        extends: true,
        resolve: { alias: ['vocabulary', 'policy', 'encounter', 'runtime'].map(tracerTier) },
        test: { name: 'tracer', include: [TRACER_TESTS] }
      }
    ]
  }
})
