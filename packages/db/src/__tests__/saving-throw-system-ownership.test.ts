import { describe, expect, it } from 'vitest'
import { upsertSavingThrow } from '../domains/shared/upserts/saving_throw.js'
import { upsertSystem } from '../domains/subjects/upserts/system.js'
import type { SystemSeedRecord } from '../source-data/content.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

const systemA = 'system-a'
const systemB = 'system-b'
const abilityId = 'ability-1'
const savingThrowId = 'saving-throw-1'

function systemRecord(id: string, abilityLabel: string): SystemSeedRecord {
  return {
    schemaVersion: 2,
    id,
    userId: `${id}-owner`,
    label: id,
    rulesetCode: id,
    rulesetVersion: '1',
    abilities: [
      {
        id: abilityId,
        code: 'MIGHT',
        label: abilityLabel
      }
    ],
    alignments: [],
    challengeRatings: [],
    conditionTypes: [],
    creatureTypes: [],
    currencies: [],
    damageTypes: [],
    heritages: [],
    languages: [],
    lifestyles: [],
    magicSchools: [],
    passives: [],
    rarities: [],
    senses: [],
    skills: [],
    speeds: [],
    terrains: []
  }
}

describe('UUID-backed saving throw System ownership', () => {
  it('rejects a foreign System vocabulary UUID without changing the existing owner', async () => {
    const db = new InMemoryDb()

    await upsertSystem(db as never, systemRecord(systemA, 'Might'))
    await expect(upsertSystem(db as never, systemRecord(systemB, 'Foreign Might'))).rejects.toThrow(
      'already owned by another System'
    )

    expect(db.snapshot('ability_definitions')).toEqual([
      expect.objectContaining({
        id: abilityId,
        system_id: systemA,
        label: 'Might'
      })
    ])
    expect(db.snapshot('systems')).toEqual([expect.objectContaining({ id: systemA })])
  })

  it('updates mutable vocabulary fields for the same System UUID', async () => {
    const db = new InMemoryDb()

    await upsertSystem(db as never, systemRecord(systemA, 'Might'))
    await upsertSystem(db as never, systemRecord(systemA, 'Strength'))

    expect(db.snapshot('ability_definitions')).toEqual([
      expect.objectContaining({
        id: abilityId,
        system_id: systemA,
        label: 'Strength'
      })
    ])
  })

  it('rejects a foreign saving throw UUID before replacing its bonuses or payload', async () => {
    const db = new InMemoryDb()
    const original = {
      id: savingThrowId,
      dcMethod: 'FIXED_DC' as const,
      abilityDefinitionId: abilityId,
      baseDc: 12
    }

    await upsertSavingThrow(db as never, original, systemA)
    await expect(
      upsertSavingThrow(db as never, { ...original, baseDc: 18 }, systemB)
    ).rejects.toThrow('already owned by another System')

    expect(db.snapshot('saving_throws')).toEqual([
      expect.objectContaining({
        id: savingThrowId,
        system_id: systemA,
        base_dc: 12
      })
    ])
  })

  it('updates a saving throw UUID within its owning System', async () => {
    const db = new InMemoryDb()
    const original = {
      id: savingThrowId,
      dcMethod: 'FIXED_DC' as const,
      abilityDefinitionId: abilityId,
      baseDc: 12
    }

    await upsertSavingThrow(db as never, original, systemA)
    await upsertSavingThrow(db as never, { ...original, baseDc: 15 }, systemA)

    expect(db.snapshot('saving_throws')).toEqual([
      expect.objectContaining({
        id: savingThrowId,
        system_id: systemA,
        base_dc: 15
      })
    ])
  })
})
