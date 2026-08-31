import { describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'

const state = vi.hoisted(() => ({ statement: '' }))

vi.mock('kysely', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    execute: async () => {
      state.statement = strings
        .map((piece, index) => `${piece}${index < values.length ? String(values[index]) : ''}`)
        .join('')
      return { rows: [] }
    }
  })
}))

import { lockCharacterAssignmentAuthority } from './characterAssignmentAuthority.js'

describe('Character assignment authority guard', () => {
  it('uses the transaction-scoped exact Character advisory key', async () => {
    const characterId = '00000000-0000-4000-8000-000000000001'
    await lockCharacterAssignmentAuthority({} as DBLike, characterId)

    expect(state.statement).toContain('pg_advisory_xact_lock')
    expect(state.statement).toContain('hashtextextended')
    expect(state.statement).toContain("'character-assignment-authority:' ||")
    expect(state.statement).toContain(`${characterId}::uuid::text`)
  })
})
