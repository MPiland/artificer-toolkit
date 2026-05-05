import { describe, expect, it } from 'vitest'

import {
  characterBuilderCommitRequestDtoSchema,
  characterBuilderSaveRequestDtoSchema
} from '../api/characters.js'
import { applyHitPointsCommandSchema } from '../domains/character/commands/index.js'

const baseRequest = {
  character: {
    id: 'character-1',
    label: 'Astra Vale',
    profile: {},
    intent: {
      advancement: { method: 'MILESTONE' },
      race: { raceId: 'race-elf' },
      background: { backgroundId: 'background-sage' },
      classes: [{ classId: 'class-wizard', classLevel: 1 }],
      abilities: {
        method: 'STANDARD_ARRAY',
        assignments: [
          { ability: 'STRENGTH', option: '8' },
          { ability: 'DEXTERITY', option: '14' },
          { ability: 'CONSTITUTION', option: '13' },
          { ability: 'INTELLIGENCE', option: '15' },
          { ability: 'WISDOM', option: '12' },
          { ability: 'CHARISMA', option: '10' }
        ]
      },
      hitpoints: {
        method: 'FIXED',
        levels: [{ level: 1, value: 6 }]
      },
      featureAcquisitions: []
    },
    state: {
      equipment: {
        inventory: [],
        equipped: [],
        attuned: []
      },
      currency: [],
      hitpoints: {
        current: 6,
        hitDice: []
      }
    },
    systemId: 'system-1',
    userId: 'user-1'
  },
  mode: 'create'
}

describe('character builder contracts', () => {
  it('keeps preview flexible while commit only accepts active targets', () => {
    expect(characterBuilderSaveRequestDtoSchema.parse({
      ...baseRequest,
      targetStatus: 'DRAFT'
    }).targetStatus).toBe('DRAFT')

    expect(() => characterBuilderCommitRequestDtoSchema.parse({
      ...baseRequest,
      targetStatus: 'DRAFT'
    })).toThrow()

    expect(characterBuilderCommitRequestDtoSchema.parse({
      ...baseRequest,
      targetStatus: 'ACTIVE'
    }).targetStatus).toBe('ACTIVE')
  })

  it('requires explicit final hit point values for class hit point commands', () => {
    const command = {
      type: 'APPLY_HIT_POINTS',
      characterId: '00000000-0000-4000-8000-000000000001',
      actorId: 'user-1',
      commandId: '00000000-0000-4000-8000-000000000002',
      expectedVersion: 1,
      classRef: { contentId: 'wizard', systemId: 'system-1' },
      classLevel: 2,
      method: 'AVERAGE',
      value: 5
    }

    expect(applyHitPointsCommandSchema.safeParse(command).success).toBe(true)
    expect(applyHitPointsCommandSchema.safeParse({
      ...command,
      value: undefined
    }).success).toBe(false)
  })

  it('requires roll provenance for rolled class hit point commands', () => {
    const command = {
      type: 'APPLY_HIT_POINTS',
      characterId: '00000000-0000-4000-8000-000000000001',
      actorId: 'user-1',
      commandId: '00000000-0000-4000-8000-000000000002',
      expectedVersion: 1,
      classRef: { contentId: 'wizard', systemId: 'system-1' },
      classLevel: 2,
      method: 'ROLLED',
      value: 7
    }

    expect(applyHitPointsCommandSchema.safeParse(command).success).toBe(false)
    expect(applyHitPointsCommandSchema.safeParse({
      ...command,
      roll: 5
    }).success).toBe(true)
  })
})
