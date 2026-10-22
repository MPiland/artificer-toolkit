import { defineConfig } from 'vitest/config'

import {
  inlineWorkspacePackages,
  sourceResolve,
  workspaceSourceAliases
} from './scripts/vitestSource.mjs'

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
    ]
  }
})
