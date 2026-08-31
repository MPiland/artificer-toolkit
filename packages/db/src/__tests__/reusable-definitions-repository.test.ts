import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { DBLike } from '../types/index.js'

const state = vi.hoisted(() => ({ calls: 0 }))
vi.mock('kysely', () => ({
  sql: () => ({
    execute: async () => {
      state.calls += 1
      return { rows: [] }
    }
  })
}))

import { createReusableDefinitionRepository } from '../repositories/reusableDefinitions.js'

describe('reusable definition repository schema boundary', () => {
  beforeEach(() => {
    state.calls = 0
  })

  it('rejects a malformed document before any persistence query', async () => {
    const repository = createReusableDefinitionRepository({} as DBLike)
    await expect(
      repository.saveDraft({
        definitionId: '11111111-1111-4111-8111-111111111111',
        actorUserId: '22222222-2222-4222-8222-222222222222',
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: { arbitrary: true },
        checksum: 'a'.repeat(64),
        authorize: () => undefined
      })
    ).rejects.toThrow()
    expect(state.calls).toBe(0)
  })

  it('locks source then its exact definition before a draft', () => {
    const source = readFileSync(
      join(process.cwd(), 'packages/db/src/repositories/reusableDefinitions.ts'),
      'utf8'
    )
    const lockRoot = source.slice(source.indexOf('async function lockRoot'))
    expect(lockRoot.indexOf('FROM public.content_sources')).toBeGreaterThan(
      lockRoot.indexOf('SELECT content_source_id, game_system_id')
    )
    expect(lockRoot.indexOf('FOR UPDATE OF definition')).toBeGreaterThan(
      lockRoot.indexOf('FROM public.content_sources')
    )
    expect(lockRoot.indexOf('FROM public.reusable_definition_drafts')).toBeGreaterThan(
      lockRoot.indexOf('FOR UPDATE OF definition')
    )
  })

  it('binds parsed draft documents to the locked root before returning or publishing them', () => {
    const source = readFileSync(
      join(process.cwd(), 'packages/db/src/repositories/reusableDefinitions.ts'),
      'utf8'
    )
    expect(source).toContain('function assertDocumentMatchesRoot(')
    expect(source).toContain('assertDocumentMatchesRoot(root, document)')
    expect(source).toContain('assertDocumentMatchesRoot(root, draft.document)')
  })
})
