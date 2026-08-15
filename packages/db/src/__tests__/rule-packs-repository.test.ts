import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '../types/index.js'

const sqlState = vi.hoisted(() => ({
  rows: [] as Array<Array<Record<string, unknown>>>,
  statements: [] as string[]
}))

vi.mock('kysely', () => {
  function render(value: unknown): string {
    return typeof value === 'object' && value !== null && 'text' in value
      ? String((value as { text: unknown }).text)
      : String(value)
  }

  const template = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings
      .map((piece, index) => `${piece}${index < values.length ? render(values[index]) : ''}`)
      .join('')
    return {
      text,
      execute: async () => {
        sqlState.statements.push(text)
        return { rows: sqlState.rows.shift() ?? [] }
      }
    }
  }

  return { sql: template }
})

import { createRulePackRepository } from '../repositories/rulePacks.js'

const timestamp = '2026-08-12T00:00:00.000Z'
const draftRow = {
  id: 'revision-1',
  rule_pack_id: 'pack-1',
  revision: 1,
  evaluator_kind: 'ZEN',
  evaluator_version: '0.54.0',
  model_contract_version: 1,
  document: { rules: [] },
  checksum: 'a'.repeat(64),
  created_by: 'user-1',
  activated_by: null,
  activated_at: null,
  created_at: timestamp,
  updated_at: timestamp
}

describe('rule pack repository', () => {
  beforeEach(() => {
    sqlState.rows = []
    sqlState.statements.length = 0
  })

  it('does not overwrite a draft when its expected timestamp is stale', async () => {
    sqlState.rows = [[{ id: 'pack-1' }], [draftRow]]
    const repository = createRulePackRepository({ isTransaction: true } as DBLike)

    await expect(
      repository.saveDraft({
        rulePackId: 'pack-1',
        expectedUpdatedAt: '2026-08-11T00:00:00.000Z',
        evaluatorKind: 'ZEN',
        evaluatorVersion: '0.54.0',
        modelContractVersion: 4,
        document: { rules: [] },
        checksum: 'b'.repeat(64),
        createdBy: 'user-1'
      })
    ).resolves.toBeNull()

    expect(sqlState.statements).toHaveLength(2)
    expect(sqlState.statements[1]).toContain('FOR UPDATE')
  })

  it('updates the locked draft after validating its millisecond timestamp', async () => {
    const hydratedDraft = { ...draftRow, updated_at: new Date(timestamp) }
    sqlState.rows = [[{ id: 'pack-1' }], [hydratedDraft], [draftRow]]
    const repository = createRulePackRepository({ isTransaction: true } as DBLike)

    await expect(
      repository.saveDraft({
        rulePackId: 'pack-1',
        expectedUpdatedAt: timestamp,
        evaluatorKind: 'ZEN',
        evaluatorVersion: '0.54.0',
        modelContractVersion: 4,
        document: { rules: [] },
        checksum: 'b'.repeat(64),
        createdBy: 'user-1'
      })
    ).resolves.toMatchObject({ id: 'revision-1', state: 'DRAFT' })

    expect(sqlState.statements).toHaveLength(3)
    expect(sqlState.statements[2]).toContain('WHERE id = revision-1')
    expect(sqlState.statements[2]).not.toContain('AND updated_at =')
    expect(sqlState.statements[2]).toContain('model_contract_version = 4')
  })

  it('activates only the exact draft checksum and points the pack at it atomically', async () => {
    sqlState.rows = [
      [{ id: 'pack-1', active_revision_id: null }],
      [{ ...draftRow, activated_by: 'user-1', activated_at: timestamp }],
      [{ id: 'pack-1' }]
    ]
    const repository = createRulePackRepository({ isTransaction: true } as DBLike)

    await expect(
      repository.activateDraft({
        rulePackId: 'pack-1',
        revisionId: 'revision-1',
        checksum: 'a'.repeat(64),
        actorId: 'user-1'
      })
    ).resolves.toMatchObject({ id: 'revision-1', state: 'ACTIVE' })

    expect(sqlState.statements[0]).toContain('FOR UPDATE')
    expect(sqlState.statements[1]).toContain('AND checksum =')
    expect(sqlState.statements[1]).toContain('AND activated_at IS NULL')
    expect(sqlState.statements[2]).toContain('SET active_revision_id =')
  })

  it('does not activate a draft when the active revision changed after a canonical merge', async () => {
    sqlState.rows = [[{ id: 'pack-1', active_revision_id: 'admin-revision' }]]
    const repository = createRulePackRepository({ isTransaction: true } as DBLike)

    await expect(
      repository.activateDraft({
        rulePackId: 'pack-1',
        revisionId: 'revision-1',
        checksum: 'a'.repeat(64),
        actorId: 'user-1',
        expectedActiveRevisionId: null
      })
    ).resolves.toBeNull()

    expect(sqlState.statements).toHaveLength(1)
    expect(sqlState.statements[0]).toContain('FOR UPDATE')
  })

  it('derives active revision state from the parent pointer', async () => {
    sqlState.rows = [
      [{ ...draftRow, activated_by: 'user-1', activated_at: timestamp, is_active: true }]
    ]
    const repository = createRulePackRepository({ isTransaction: true } as DBLike)

    await expect(repository.getRevision('revision-1')).resolves.toMatchObject({ state: 'ACTIVE' })
    expect(sqlState.statements[0]).toContain('revision.id = pack.active_revision_id AS is_active')
  })

  it('loads an exact revision and its pack identity in one read', async () => {
    sqlState.rows = [
      [
        {
          ...draftRow,
          pack_id: 'pack-1',
          pack_ruleset_code: 'DND5E',
          pack_version: '2014',
          pack_active_revision_id: null,
          pack_created_at: timestamp,
          pack_updated_at: timestamp
        }
      ]
    ]
    const repository = createRulePackRepository({ isTransaction: true } as DBLike)

    await expect(repository.getRevisionWithPack('revision-1')).resolves.toMatchObject({
      pack: { rulesetCode: 'DND5E', version: '2014' },
      revision: {
        evaluatorKind: 'ZEN',
        evaluatorVersion: '0.54.0',
        modelContractVersion: 1
      }
    })

    expect(sqlState.statements).toHaveLength(1)
    expect(sqlState.statements[0]).toContain('JOIN public.rule_packs pack')
    expect(sqlState.statements[0]).toContain('FOR SHARE OF pack, revision')
  })

  it('locks and returns the System ruleset identity used for binding', async () => {
    sqlState.rows = [[{ system_id: 'system-1', ruleset_code: 'dnd5e', ruleset_version: '2014' }]]
    const repository = createRulePackRepository({ isTransaction: true } as DBLike)

    await expect(repository.findRulesetForSystem('system-1')).resolves.toEqual({
      systemId: 'system-1',
      code: 'dnd5e',
      version: '2014'
    })

    expect(sqlState.statements[0]).toContain('FROM public.systems')
    expect(sqlState.statements[0]).toContain('FOR SHARE')
  })

  it('loads the seeded ruleset owner used to activate canonical revisions', async () => {
    sqlState.rows = [
      [
        {
          system_id: 'system-1',
          ruleset_code: 'dnd5e',
          ruleset_version: '2014',
          owner_id: 'seed-owner-1'
        }
      ]
    ]
    const repository = createRulePackRepository({ isTransaction: true } as DBLike)

    await expect(repository.findSeededRuleset('dnd5e', '2014')).resolves.toEqual({
      systemId: 'system-1',
      code: 'dnd5e',
      version: '2014',
      ownerId: 'seed-owner-1'
    })

    expect(sqlState.statements[0]).toContain('user_id AS owner_id')
    expect(sqlState.statements[0]).toContain('user_id IS NOT NULL')
    expect(sqlState.statements[0]).toContain('LIMIT 1')
    expect(sqlState.statements[0]).toContain('FOR SHARE')
  })

  it('backfills only unpinned active Characters for the matching ruleset', async () => {
    sqlState.rows = [[{ id: 'character-1' }, { id: 'character-2' }]]
    const repository = createRulePackRepository({ isTransaction: true } as DBLike)

    await expect(
      repository.backfillActiveCharacterRevision({
        rulesetCode: 'dnd5e',
        version: '2014',
        revisionId: 'revision-1'
      })
    ).resolves.toBe(2)

    expect(sqlState.statements[0]).toContain("character.status = 'ACTIVE'")
    expect(sqlState.statements[0]).toContain('character.rule_pack_revision_id IS NULL')
    expect(sqlState.statements[0]).toContain('system.ruleset_code = dnd5e')
    expect(sqlState.statements[0]).toContain('system.ruleset_version = 2014')
  })
})
