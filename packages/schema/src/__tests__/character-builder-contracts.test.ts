import { describe, expect, it } from 'vitest'

import {
  characterBuilderDraftPayloadDtoSchema,
  characterBuilderFormDtoSchema,
  characterBuilderIntentCacheDtoSchema,
  characterBuilderCommitRequestDtoSchema,
  characterBuilderSaveRequestDtoSchema
} from '../api/characters.js'

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
        levels: [{ level: 1, classId: 'class-wizard', classLevel: 1, value: 6 }]
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

  it('requires explicit class identity for each hit point level', () => {
    const request = structuredClone(baseRequest)
    const level = request.character.intent.hitpoints.levels[0] as Partial<{
      classId: string
      classLevel: number
    }>
    delete level.classId

    expect(() => characterBuilderSaveRequestDtoSchema.parse({
      ...request,
      targetStatus: 'DRAFT'
    })).toThrow()
  })

  it('rejects legacy direct-character draft payloads', () => {
    expect(characterBuilderDraftPayloadDtoSchema.safeParse(baseRequest.character).success).toBe(
      false
    )
    expect(
      characterBuilderDraftPayloadDtoSchema.parse({ character: baseRequest.character }).character.id
    ).toBe('character-1')
  })

  it('rejects unknown and mismatched cached ability methods', () => {
    expect(
      characterBuilderIntentCacheDtoSchema.safeParse({
        abilities: { activeMethod: 'UNKNOWN', methods: {} }
      }).success
    ).toBe(false)

    expect(
      characterBuilderIntentCacheDtoSchema.safeParse({
        abilities: {
          activeMethod: 'POINT_BUY',
          methods: {
            POINT_BUY: baseRequest.character.intent.abilities
          }
        }
      }).success
    ).toBe(false)
  })

  it('rejects unsupported builder form discriminants', () => {
    expect(
      characterBuilderFormDtoSchema.safeParse({
        ...baseRequest.character,
        intent: {
          ...baseRequest.character.intent,
          abilities: {
            ...baseRequest.character.intent.abilities,
            method: 'CUSTOM'
          }
        }
      }).success
    ).toBe(false)
  })

  it('rejects duplicate chosen grant selections for the same owning source', () => {
    const chosenGrantSelections = [
      {
        id: 'selection-1',
        grantId: 'grant-1',
        source: { kind: 'CLASS' as const, classId: 'class-wizard', classLevel: 1 },
        timing: { kind: 'CLASS_LEVEL' as const, classId: 'class-wizard', classLevel: 1 },
        targetIds: ['skill-arcana']
      },
      {
        id: 'selection-2',
        grantId: 'grant-1',
        source: { kind: 'CLASS' as const, classId: 'class-wizard', classLevel: 5 },
        timing: { kind: 'CLASS_LEVEL' as const, classId: 'class-wizard', classLevel: 5 },
        targetIds: ['skill-history']
      }
    ]

    expect(() => characterBuilderSaveRequestDtoSchema.parse({
      ...baseRequest,
      character: {
        ...baseRequest.character,
        intent: {
          ...baseRequest.character.intent,
          chosenGrantSelections
        }
      },
      targetStatus: 'DRAFT'
    })).toThrow(/unique by grant, source, and progression level/i)
  })

  it('allows the same grant for different owning sources or progression levels', () => {
    const chosenGrantSelections = [
      {
        id: 'selection-class-root',
        grantId: 'grant-1',
        source: { kind: 'CLASS' as const, classId: 'class-wizard' },
        timing: { kind: 'CLASS_LEVEL' as const, classId: 'class-wizard', classLevel: 1 },
        targetIds: ['skill-arcana']
      },
      {
        id: 'selection-subclass-root',
        grantId: 'grant-1',
        source: { kind: 'SUBCLASS' as const, subclassId: 'class-school-evocation' },
        timing: { kind: 'CLASS_LEVEL' as const, classId: 'class-wizard', classLevel: 2 },
        targetIds: ['skill-history']
      },
      {
        id: 'selection-class-level-3',
        grantId: 'grant-1',
        source: { kind: 'CLASS' as const, classId: 'class-wizard', classLevel: 3 },
        timing: { kind: 'CLASS_LEVEL' as const, classId: 'class-wizard', classLevel: 3 },
        progressionLevel: 3,
        targetIds: ['skill-religion']
      }
    ]

    expect(() => characterBuilderSaveRequestDtoSchema.parse({
      ...baseRequest,
      character: {
        ...baseRequest.character,
        intent: {
          ...baseRequest.character.intent,
          chosenGrantSelections
        }
      },
      targetStatus: 'DRAFT'
    })).not.toThrow()
  })
})
