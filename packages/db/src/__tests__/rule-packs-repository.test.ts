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
        document: { rules: [] },
        checksum: 'b'.repeat(64),
        createdBy: 'user-1'
      })
    ).resolves.toMatchObject({ id: 'revision-1', state: 'DRAFT' })

    expect(sqlState.statements).toHaveLength(3)
    expect(sqlState.statements[2]).toContain('WHERE id = revision-1')
    expect(sqlState.statements[2]).not.toContain('AND updated_at =')
  })

  it('activates only the exact draft checksum and points the pack at it atomically', async () => {
    sqlState.rows = [
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

    expect(sqlState.statements[0]).toContain('AND checksum =')
    expect(sqlState.statements[0]).toContain('AND activated_at IS NULL')
    expect(sqlState.statements[1]).toContain('SET active_revision_id =')
  })

  it('derives active revision state from the parent pointer', async () => {
    sqlState.rows = [
      [{ ...draftRow, activated_by: 'user-1', activated_at: timestamp, is_active: true }]
    ]
    const repository = createRulePackRepository({ isTransaction: true } as DBLike)

    await expect(repository.getRevision('revision-1')).resolves.toMatchObject({ state: 'ACTIVE' })
    expect(sqlState.statements[0]).toContain('revision.id = pack.active_revision_id AS is_active')
  })
})
