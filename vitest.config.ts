import { configDefaults, defineConfig } from 'vitest/config'

import {
  inlineWorkspacePackages,
  sourceResolve,
  tracerTierAliases,
  workspaceSourceAliases
} from './scripts/vitestSource.mjs'

const TRACER_TESTS = 'packages/rules-runtime/src/__tests__/tracer/**/*.test.ts'

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
        resolve: { alias: tracerTierAliases },
        test: { name: 'tracer', include: [TRACER_TESTS] }
      }
    ]
  }
})
