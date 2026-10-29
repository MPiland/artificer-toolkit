import { describe, expect, it } from 'vitest'
import {
  forbiddenDependency,
  isExcluded,
  retiredWorkspaceNames,
  sourceViolations,
  workspaceDependencyViolations
} from './auditNativeBoundaries.mjs'

const rules = (path, source) => sourceViolations(path, source).map(({ rule }) => rule)

describe('sourceViolations', () => {
  it.each([
    ['supabase.ts', "import '@supabase/supabase-js'", 'removed Supabase product API'],
    ['database.ts', "import { sql } from 'kysely'", 'removed Kysely/Postgres application SQL'],
    ['schema.sql', 'select 1', 'removed Kysely/Postgres application SQL'],
    ['rules.ts', "import '@gorules/zen-engine'", 'removed GoRules/Rule Studio surface'],
    ['client.ts', "fetch('/api/trpc/campaign')", 'removed tRPC surface'],
    [
      'client.ts',
      "fetch('/.netlify/functions/cleanup-media')",
      'removed Netlify hosting surface (ADR 0037)'
    ],
    [
      'apps/web/src/server/auth/convex.server.ts',
      "import { getContext } from '@netlify/functions'",
      'removed Netlify hosting surface (ADR 0037)'
    ],
    ['client.ts', "import '@artificer-toolkit/db'", 'retired workspace path'],
    [
      'packages/encounter-persistence/src/store.ts',
      "import { api } from '@artificer-toolkit/apis/convex/api'",
      'package imports an app'
    ],
    [
      'packages/encounter-persistence/src/store.ts',
      "import { db } from '../../../apps/apis/convex/db'",
      'package imports an app'
    ]
  ])('flags %s: %s', (path, source, rule) => {
    expect(rules(path, source)).toContain(rule)
  })

  it('lets an app import its own workspace', () => {
    expect(rules('apps/apis/convex/a.ts', "import '@artificer-toolkit/apis'")).toEqual([])
  })

  it('flags a package runtime import outside its runtime dependencies', () => {
    expect(
      rules(
        'packages/authoring/src/imports/importedEquipmentTerms.ts',
        "import { SRD_GOLD_CURRENCY_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'"
      )
    ).toEqual([
      '@artificer-toolkit/authoring runtime source imports @artificer-toolkit/source-data'
    ])
    expect(
      rules(
        'packages/authoring/src/nodeRuntime/systemSourceRows.ts',
        "const codes = await import('@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes')"
      )
    ).toEqual([
      '@artificer-toolkit/authoring runtime source imports @artificer-toolkit/rules-runtime'
    ])
    expect(
      rules('packages/shared/src/core/index.ts', "export * from '@artificer-toolkit/schema/api'")
    ).toEqual([])
  })

  it('allows a package runtime import of its runtime dependencies and itself', () => {
    expect(
      rules(
        'packages/authoring/src/imports/importPreparation.ts',
        "import type { ImportIssueDto } from '@artificer-toolkit/schema/api/imports'\nimport { x } from '@artificer-toolkit/authoring/imports'"
      )
    ).toEqual([])
    expect(
      rules(
        'packages/rules-runtime/src/index.ts',
        "import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'"
      )
    ).toEqual([])
  })
})

describe('isExcluded', () => {
  it('skips Markdown, tests, test support and roadmap tooling but not runtime scripts', () => {
    expect(isExcluded('docs/history.md')).toBe(true)
    expect(isExcluded('apps/web/src/legacy.test.ts')).toBe(true)
    expect(isExcluded('packages/authoring/src/tests/srdSourceReader.ts')).toBe(true)
    expect(isExcluded('scripts/phase8/buildPhaseLedger.mjs')).toBe(true)
    expect(isExcluded('scripts/liveBackendValidation.mjs')).toBe(false)
    expect(isExcluded('packages/authoring/src/imports/importedEquipmentTerms.ts')).toBe(false)
  })
})

describe('workspaceDependencyViolations', () => {
  const violations = (path, manifest) => workspaceDependencyViolations(path, manifest).length

  it('refuses a package depending on an app or on a package outside its direction', () => {
    expect(
      violations('packages/encounter-persistence/package.json', {
        name: '@artificer-toolkit/encounter-persistence',
        dependencies: { '@artificer-toolkit/apis': 'workspace:^' }
      })
    ).toBe(1)
    expect(
      violations('packages/rules-runtime/package.json', {
        name: '@artificer-toolkit/rules-runtime',
        dependencies: { '@artificer-toolkit/encounter-persistence': 'workspace:^' }
      })
    ).toBe(1)
    expect(
      violations('apps/session-worker/package.json', {
        name: '@artificer-toolkit/session-worker',
        dependencies: { '@artificer-toolkit/apis': 'workspace:^' }
      })
    ).toBe(1)
  })

  it('allows test dependencies only as devDependencies of the package that declares them', () => {
    const authoring = (section) =>
      violations('packages/authoring/package.json', {
        name: '@artificer-toolkit/authoring',
        [section]: {
          '@artificer-toolkit/rules-runtime': 'workspace:^',
          '@artificer-toolkit/source-data': 'workspace:^'
        }
      })
    expect(authoring('devDependencies')).toBe(0)
    expect(authoring('dependencies')).toBe(2)
    expect(authoring('peerDependencies')).toBe(2)
    expect(
      violations('packages/encounter-persistence/package.json', {
        name: '@artificer-toolkit/encounter-persistence',
        devDependencies: { '@artificer-toolkit/source-data': 'workspace:^' }
      })
    ).toBe(1)
  })
})

describe('forbidden dependencies', () => {
  it('names the removed services and retired workspaces', () => {
    expect(forbiddenDependency.test('@trpc/server')).toBe(true)
    expect(forbiddenDependency.test('@netlify/vite-plugin-tanstack-start')).toBe(true)
    expect(forbiddenDependency.test('netlify-cli')).toBe(true)
    expect(retiredWorkspaceNames.has('@artificer-toolkit/functions')).toBe(true)
  })
})
