import { describe, expect, it, vi } from 'vitest'

vi.mock('../domains/subjects/upserts/system.js', () => ({
  upsertSystem: vi.fn(async () => {})
}))

import { createSystemRepository } from '../repositories/index.js'

type RowMap = Record<string, unknown[]>

function createFakeDb(rowsByTable: RowMap) {
  return {
    selectFrom(table: string) {
      const rows = [...(rowsByTable[table] ?? [])]
      const state = {
        filtered: rows
      }

      const builder = {
        select() {
          return builder
        },
        where(column: string, _op: string, value: string) {
          state.filtered = state.filtered.filter((row) => {
            const record = row as Record<string, unknown>
            return record[column] === value
          })
          return builder
        },
        orderBy() {
          return builder
        },
        async execute() {
          return state.filtered
        },
        async executeTakeFirst() {
          return state.filtered[0] ?? undefined
        }
      }

      return builder
    }
  }
}

describe('createSystemRepository', () => {
  it('hydrates one system with all vocabulary surfaces', async () => {
    const db = createFakeDb({
      systems: [
        {
          id: 'system-1',
          label: 'SRD',
          description: 'System description',
          user_id: 'user-1'
        }
      ],
      alignments: [{ id: 'a-1', system_id: 'system-1', code: 'LG', label: 'Lawful Good', description: null, tooltip: null, short: 'LG' }],
      condition_types: [{ id: 'c-1', system_id: 'system-1', code: 'BLINDED', label: 'Blinded', description: null, tooltip: null, short: null }],
      currencies: [{ id: 'cur-1', system_id: 'system-1', code: 'GP', label: 'Gold Piece', description: null, tooltip: null, short: 'gp' }],
      damage_types: [{ id: 'd-1', system_id: 'system-1', code: 'FIRE', label: 'Fire', description: null, tooltip: null, short: null }],
      heritages: [{ id: 'h-1', system_id: 'system-1', code: 'ELVEN', label: 'Elven', description: null, tooltip: null, short: null }],
      languages: [{ id: 'l-1', system_id: 'system-1', code: 'COMMON', label: 'Common', description: null, tooltip: null, short: null }],
      magic_schools: [{ id: 'm-1', system_id: 'system-1', code: 'EVOCATION', label: 'Evocation', description: null, tooltip: null, short: null }],
      passives: [{ id: 'p-1', system_id: 'system-1', code: 'PASSIVE_PERCEPTION', label: 'Passive Perception', description: null, tooltip: null, short: null }],
      rarities: [{ id: 'r-1', system_id: 'system-1', code: 'COMMON', label: 'Common', description: null, tooltip: null, short: null }],
      senses: [{ id: 's-1', system_id: 'system-1', code: 'DARKVISION', label: 'Darkvision', description: null, tooltip: null, short: null }],
      skills: [{ id: 'sk-1', system_id: 'system-1', code: 'ARCANA', label: 'Arcana', description: null, tooltip: null, short: null }],
      speeds: [{ id: 'sp-1', system_id: 'system-1', code: 'WALK', label: 'Walk', description: null, tooltip: null, short: null }],
      terrains: [{ id: 't-1', system_id: 'system-1', code: 'FOREST', label: 'Forest', description: null, tooltip: null, short: null }]
    })

    const repository = createSystemRepository(db as never)
    const system = await repository.findById('system-1')

    expect(system).toEqual({
      id: 'system-1',
      label: 'SRD',
      description: 'System description',
      userId: 'user-1',
      alignments: [{ id: 'a-1', code: 'LG', label: 'Lawful Good', description: null, tooltip: null, short: 'LG' }],
      challengeRatings: [],
      conditionTypes: [{ id: 'c-1', code: 'BLINDED', label: 'Blinded', description: null, tooltip: null, short: null }],
      creatureTypes: [],
      currencies: [{ id: 'cur-1', code: 'GP', label: 'Gold Piece', description: null, tooltip: null, short: 'gp' }],
      damageTypes: [{ id: 'd-1', code: 'FIRE', label: 'Fire', description: null, tooltip: null, short: null }],
      heritages: [{ id: 'h-1', code: 'ELVEN', label: 'Elven', description: null, tooltip: null, short: null }],
      languages: [{ id: 'l-1', code: 'COMMON', label: 'Common', description: null, tooltip: null, short: null }],
      lifestyles: [],
      magicSchools: [{ id: 'm-1', code: 'EVOCATION', label: 'Evocation', description: null, tooltip: null, short: null }],
      passives: [{ id: 'p-1', code: 'PASSIVE_PERCEPTION', label: 'Passive Perception', description: null, tooltip: null, short: null }],
      rarities: [{ id: 'r-1', code: 'COMMON', label: 'Common', description: null, tooltip: null, short: null }],
      senses: [{ id: 's-1', code: 'DARKVISION', label: 'Darkvision', description: null, tooltip: null, short: null }],
      skills: [{ id: 'sk-1', code: 'ARCANA', label: 'Arcana', description: null, tooltip: null, short: null }],
      speeds: [{ id: 'sp-1', code: 'WALK', label: 'Walk', description: null, tooltip: null, short: null }],
      terrains: [{ id: 't-1', code: 'FOREST', label: 'Forest', description: null, tooltip: null, short: null }]
    })
  })

  it('throws when a hydrated system is missing user ownership', async () => {
    const db = createFakeDb({
      systems: [
        {
          id: 'system-1',
          label: 'SRD',
          description: null,
          user_id: null
        }
      ]
    })

    const repository = createSystemRepository(db as never)

    await expect(repository.findById('system-1')).rejects.toThrow(
      'missing user_id'
    )
  })
})
