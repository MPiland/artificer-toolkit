import {
  ADVANCEMENT_METHOD_CODE,
  CHARACTER_ABILITY_GENERATION_METHOD
} from '@artificer-toolkit/shared/core'
import { describe, expect, it } from 'vitest'
import {
  buildCharacterDraftSaveInput,
  cacheActiveAbilityIntent,
  clearBackgroundDependents,
  clearClassOwnedChoices,
  clearPrimaryClassDependents,
  clearRaceDependents,
  createFallbackCharacterFormValues,
  createStartingEquipmentDecision,
  getReadinessMessages,
  normalizeCharacterForCommit,
  normalizeCharacterForDraft,
  toCharacterFormValues,
  totalClassLevel
} from '../characterBuilder.utils'
import {
  characterBuilderDraftPayloadFixture,
  characterBuilderPayloadFixture
} from '../character.fixtures'

describe('character builder utilities', () => {
  it('creates draft-safe fallback values without normalized child placeholders', () => {
    expect(createFallbackCharacterFormValues('system-1')).toMatchObject({
      id: 'pending-character',
      label: '',
      systemId: 'system-1',
      intent: {
        advancement: { method: ADVANCEMENT_METHOD_CODE.MILESTONE },
        classes: [],
        featureAcquisitions: []
      },
      state: {
        equipment: {
          inventory: [],
          equipped: [],
          attuned: []
        },
        currency: []
      }
    })
  })

  it('normalizes standard-array draft and commit payloads through the strict authored schema', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)

    expect(normalizeCharacterForDraft(values)).toMatchObject({
      id: 'character-owned',
      status: 'DRAFT',
      intent: {
        abilities: {
          method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY
        }
      }
    })
    expect(normalizeCharacterForCommit(values)).toMatchObject({
      id: 'character-owned',
      status: 'ACTIVE'
    })
  })

  it('converts manual ability form state without leaking roll metadata into invalid shapes', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)
    values.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      assignments: [],
      state: {
        assignments: [{ ability: 'STRENGTH', score: 16 }],
        rollGroups: [{ temporary: true }]
      }
    }

    const normalized = normalizeCharacterForDraft(values)

    expect(normalized.intent.abilities).toEqual({
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: {
        assignments: [{ ability: 'STRENGTH', score: 16 }]
      }
    })
  })

  it('preserves inactive ability method intent in the draft-only builder cache', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)
    values.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      assignments: [],
      state: {
        assignments: [{ ability: 'STRENGTH', score: 16 }],
        rollGroups: [
          { rolls: [
            6,
            5,
            4,
            1
          ], total: 15 }
        ]
      }
    }
    values.builderIntent = {
      abilities: cacheActiveAbilityIntent(values.builderIntent?.abilities, values.intent.abilities)
    }
    values.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
      assignments: [{ ability: 'STRENGTH', option: '15' }]
    }

    const draftInput = buildCharacterDraftSaveInput(values, 'create')

    expect(draftInput.character.intent.abilities).toMatchObject({
      method: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
    })
    expect(
      draftInput.builderIntent?.abilities?.methods[CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED]
    ).toMatchObject({
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: {
        assignments: [{ ability: 'STRENGTH', score: 16 }],
        rollGroups: [
          { rolls: [
            6,
            5,
            4,
            1
          ], total: 15 }
        ]
      }
    })
  })

  it('reports builder readiness from backend view data', () => {
    expect(getReadinessMessages(characterBuilderPayloadFixture.resolution)).toEqual([])
    expect(getReadinessMessages(characterBuilderDraftPayloadFixture.resolution)).toEqual([
      'Choose a race.',
      'Choose a class.',
      'Race',
      'Class'
    ])
  })

  it('calculates class level from builder form rows', () => {
    expect(totalClassLevel(toCharacterFormValues(characterBuilderPayloadFixture))).toBe(1)
  })

  it('clears race-owned dependent selections when the race changes', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)
    values.intent.featureAcquisitions = [
      {
        id: 'race-feature-choice',
        featureId: 'race-feature',
        source: { kind: 'RACE', raceId: 'race-elf' },
        timing: { kind: 'IMMEDIATE' }
      },
      {
        id: 'class-feature-choice',
        featureId: 'class-feature',
        source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    const cleared = clearRaceDependents(values)

    expect(cleared.intent.race.subraceId).toBeUndefined()
    expect(cleared.intent.ancestrySelections).toBeUndefined()
    expect(cleared.intent.featureAcquisitions.map((acquisition) => acquisition.id)).toEqual(['class-feature-choice'])
  })

  it('clears class-owned choices and primary starting equipment independently', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)
    values.intent.startingEquipment = {
      class: createStartingEquipmentDecision('CLASS'),
      background: createStartingEquipmentDecision('BACKGROUND')
    }
    values.intent.featureAcquisitions = [
      {
        id: 'class-feature-choice',
        featureId: 'class-feature',
        source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      },
      {
        id: 'background-feature-choice',
        featureId: 'background-feature',
        source: { kind: 'BACKGROUND', backgroundId: 'background-sage' },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    values.intent.spellSelections = [
      {
        id: 'class-spell-choice',
        source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-magic-missile']
      }
    ]
    values.intent.resourceGrants = [
      {
        id: 'class-resource-choice',
        resourceId: 'resource-arcane-recovery',
        source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    const withoutClassChoices = clearClassOwnedChoices(values, values.intent.classes[0])
    const withoutPrimaryEquipment = clearPrimaryClassDependents(withoutClassChoices)

    expect(withoutPrimaryEquipment.intent.startingEquipment?.class).toBeUndefined()
    expect(withoutPrimaryEquipment.intent.startingEquipment?.background).toBeDefined()
    expect(withoutPrimaryEquipment.intent.featureAcquisitions.map((acquisition) => acquisition.id)).toEqual(['background-feature-choice'])
    expect(withoutPrimaryEquipment.intent.spellSelections).toBeUndefined()
    expect(withoutPrimaryEquipment.intent.resourceGrants).toBeUndefined()
  })

  it('clears background-owned choices and starting equipment when background changes', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)
    values.intent.startingEquipment = {
      background: createStartingEquipmentDecision('BACKGROUND')
    }
    values.intent.featureAcquisitions = [
      {
        id: 'background-feature-choice',
        featureId: 'background-feature',
        source: { kind: 'BACKGROUND', backgroundId: 'background-sage' },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    const cleared = clearBackgroundDependents(values)

    expect(cleared.intent.startingEquipment).toBeUndefined()
    expect(cleared.intent.featureAcquisitions).toEqual([])
  })
})
