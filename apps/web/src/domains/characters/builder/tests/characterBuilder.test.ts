import {
  ADVANCEMENT_METHOD_CODE,
  CHARACTER_ABILITY_GENERATION_METHOD
} from '@artificer-toolkit/shared/core'
import { describe, expect, it } from 'vitest'
import type { RollResultDto } from '@artificer-toolkit/schema/api/rolls'
import {
  buildCharacterDraftSaveInput,
  createFallbackCharacterFormValues,
  normalizeCharacterForDraft,
  toCharacterFormValues
} from '../shared/formNormalization'
import {
  applyManualAbilityRoll,
  cacheActiveAbilityIntent,
  getAssignedAbilityCodes,
  getAbilityDraftSlots,
  getInactiveAbilityIntentMethodLabels,
  setAbilityDraftSlots
} from '../steps/abilities/abilityGeneration'
import {
  clearBackgroundDependents,
  clearClassOwnedChoices,
  clearPrimaryClassDependents,
  clearRaceDependents,
  clearSubclassOwnedChoices
} from '../shared/dependencyClearing'
import { createStartingEquipmentDecision } from '../steps/equipment/startingEquipment'
import { getCharacterBuilderResolutionFingerprint } from '../state/resolutionFingerprints'
import { characterBuilderPayloadFixture } from '../fixtures/characterBuilder.fixtures'

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
      id: characterBuilderPayloadFixture.character.id,
      status: 'DRAFT',
      intent: {
        abilities: {
          method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY
        }
      }
    })
    expect(normalizeCharacterForDraft(values)).not.toHaveProperty('primaryRulesCatalogueId')
  })

  it('fingerprints only fields that affect Builder resolution', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)
    const initialFingerprint = getCharacterBuilderResolutionFingerprint(values)
    const proseEdit = structuredClone(values)
    proseEdit.description = '<p>Updated prose that does not affect the build.</p>'
    proseEdit.profile.notes = 'Updated table notes.'
    proseEdit.state.hitpoints.current = 3
    if (proseEdit.state.equipment.inventory[0]) {
      proseEdit.state.equipment.inventory[0].notes = 'Updated inventory notes.'
    }

    expect(getCharacterBuilderResolutionFingerprint(proseEdit)).toBe(initialFingerprint)

    const structuralEdit = structuredClone(values)
    structuralEdit.intent.classes[0].classLevel += 1

    expect(getCharacterBuilderResolutionFingerprint(structuralEdit)).not.toBe(initialFingerprint)

    const rollEvidenceEdit = structuredClone(values)
    rollEvidenceEdit.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: { configuration: '4d6dl1r1', assignments: [] }
    }
    const evidenceFingerprint = getCharacterBuilderResolutionFingerprint(rollEvidenceEdit)
    rollEvidenceEdit.intent.abilities.state.configuration = '4d6kh3'
    expect(getCharacterBuilderResolutionFingerprint(rollEvidenceEdit)).toBe(evidenceFingerprint)
  })

  it('applies authoritative ability roll evidence to one draft slot', () => {
    const abilities: ReturnType<typeof createFallbackCharacterFormValues>['intent']['abilities'] = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: { assignments: [], rollGroups: [] }
    }
    const slots = [{ ability: 'STRENGTH' as const }, {}, {}, {}, {}, {}]
    const roll = {
      id: 'roll-1',
      normalizedExpression: '4d6dl1r1',
      evidence: {
        terms: [
          {
            count: 4,
            die: 6,
            modifier: 0,
            rolls: [4, 5, 2, 6],
            rollSequences: [[1, 4], [5], [2], [6]],
            subtotal: 15,
            keptRollIndexes: [0, 1, 3]
          }
        ],
        modifier: 0,
        mode: 'NORMAL',
        keep: 'FIRST',
        subtotal: 15,
        transform: { kind: 'NONE' },
        total: 15
      }
    } satisfies RollResultDto

    const result = applyManualAbilityRoll(undefined, abilities, slots, 0, roll)

    expect(result.slots[0]).toEqual({ ability: 'STRENGTH', score: 15 })
    expect(result.abilities).toMatchObject({
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: {
        configuration: '4d6dl1r1',
        assignments: [{ ability: 'STRENGTH', score: 15 }],
        rollGroups: [
          {
            id: 'assignment-0:roll-1',
            rolls: [
              { die: 6, value: 1 },
              { die: 6, value: 4 },
              { die: 6, value: 5 },
              { die: 6, value: 2 },
              { die: 6, value: 6 }
            ],
            kept: [
              { die: 6, value: 4 },
              { die: 6, value: 5 },
              { die: 6, value: 6 }
            ],
            assignedAbility: 'STRENGTH',
            score: 15
          }
        ]
      }
    })
  })

  it('converts manual ability form state without leaking roll metadata into invalid shapes', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)
    values.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: {
        assignments: [{ ability: 'STRENGTH', score: 16 }],
        rollGroups: [
          {
            id: 'roll-group-1',
            rolls: [
              { die: 6, value: 6 },
              { die: 6, value: 5 },
              { die: 6, value: 4 },
              { die: 6, value: 1 }
            ],
            kept: [
              { die: 6, value: 6 },
              { die: 6, value: 5 },
              { die: 6, value: 4 }
            ],
            score: 15
          }
        ]
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

  it('counts manual ability assignments outside standard-array values', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)
    values.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: {
        assignments: [{ ability: 'STRENGTH', score: 18 }]
      }
    }

    expect(getAssignedAbilityCodes(values.intent.abilities)).toEqual(['STRENGTH'])
  })

  it('preserves inactive ability method intent in the draft-only builder cache', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)
    values.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: {
        assignments: [{ ability: 'STRENGTH', score: 16 }],
        rollGroups: [
          {
            id: 'roll-group-1',
            rolls: [
              { die: 6, value: 6 },
              { die: 6, value: 5 },
              { die: 6, value: 4 },
              { die: 6, value: 1 }
            ],
            kept: [
              { die: 6, value: 6 },
              { die: 6, value: 5 },
              { die: 6, value: 4 }
            ],
            score: 15
          }
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

    const draftInput = buildCharacterDraftSaveInput(values, 'create', 'draft-generation')

    expect(draftInput.character.intent.abilities).toMatchObject({
      method: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
    })
    expect(
      draftInput.builderIntent?.abilities?.methods[
        CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
      ]
    ).toMatchObject({
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: {
        assignments: [{ ability: 'STRENGTH', score: 16 }],
        rollGroups: [
          {
            id: 'roll-group-1',
            rolls: [
              { die: 6, value: 6 },
              { die: 6, value: 5 },
              { die: 6, value: 4 },
              { die: 6, value: 1 }
            ],
            kept: [
              { die: 6, value: 6 },
              { die: 6, value: 5 },
              { die: 6, value: 4 }
            ],
            score: 15
          }
        ]
      }
    })
  })

  it('keeps six partial ability slots per method while canonical intent contains only complete pairs', () => {
    const values = createFallbackCharacterFormValues()
    const standardSlots = [
      { ability: 'STRENGTH' as const, option: '15' },
      { option: '14' },
      {},
      {},
      {},
      {}
    ]
    const standard = setAbilityDraftSlots(
      undefined,
      values.intent.abilities,
      CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
      standardSlots
    )

    expect(standard.abilities).toEqual({
      method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
      assignments: [{ ability: 'STRENGTH', option: '15' }]
    })
    expect(standard.cache.drafts?.STANDARD_ARRAY?.slots).toHaveLength(6)

    const pointBuy = setAbilityDraftSlots(
      standard.cache,
      standard.abilities,
      CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
      [{ ability: 'DEXTERITY', option: '14' }, {}, {}, {}, {}, {}]
    )

    expect(
      getAbilityDraftSlots(
        pointBuy.cache,
        pointBuy.abilities,
        CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY
      )
    ).toEqual(standardSlots)
  })

  it('sends the draft generation without a client-owned active baseline', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)

    const draftInput = buildCharacterDraftSaveInput(values, 'edit', 'draft-generation')

    expect(draftInput.expectedDraftId).toBe('draft-generation')
    expect(draftInput).not.toHaveProperty('baseActiveUpdatedAt')
    expect(draftInput.character).not.toHaveProperty('primaryRulesCatalogueId')
  })

  it('reports inactive ability intent methods for the draft-save notice', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)
    values.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: {
        assignments: [{ ability: 'STRENGTH', score: 16 }]
      }
    }
    values.builderIntent = {
      abilities: cacheActiveAbilityIntent(values.builderIntent?.abilities, values.intent.abilities)
    }
    values.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
      assignments: [{ ability: 'STRENGTH', option: '15' }]
    }

    expect(getInactiveAbilityIntentMethodLabels(values)).toEqual([
      'Standard Array',
      'Manual / Rolled'
    ])
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
    expect(cleared.intent.featureAcquisitions.map((acquisition) => acquisition.id)).toEqual([
      'class-feature-choice'
    ])
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
    expect(
      withoutPrimaryEquipment.intent.featureAcquisitions.map((acquisition) => acquisition.id)
    ).toEqual(['background-feature-choice'])
    expect(withoutPrimaryEquipment.intent.spellSelections).toBeUndefined()
    expect(withoutPrimaryEquipment.intent.resourceGrants).toBeUndefined()
  })

  it('clears subclass-owned choices without dropping base class choices', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)
    const classRow = {
      ...values.intent.classes[0],
      subclassId: 'subclass-evoker'
    }
    values.intent.classes = [classRow]
    values.intent.featureAcquisitions = [
      {
        id: 'class-feature-choice',
        featureId: 'class-feature',
        source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      },
      {
        id: 'subclass-feature-choice',
        featureId: 'subclass-feature',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-evoker', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    values.intent.spellSelections = [
      {
        id: 'class-spell-choice',
        source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-magic-missile']
      },
      {
        id: 'subclass-spell-choice',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-evoker', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-burning-hands']
      }
    ]
    values.intent.resourceGrants = [
      {
        id: 'class-resource-choice',
        resourceId: 'resource-arcane-recovery',
        source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      },
      {
        id: 'subclass-resource-choice',
        resourceId: 'resource-evocation-sculpting',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-evoker', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    const cleared = clearSubclassOwnedChoices(values, classRow)

    expect(cleared.intent.featureAcquisitions.map((acquisition) => acquisition.id)).toEqual([
      'class-feature-choice'
    ])
    expect(cleared.intent.spellSelections?.map((selection) => selection.id)).toEqual([
      'class-spell-choice'
    ])
    expect(cleared.intent.resourceGrants?.map((grant) => grant.id)).toEqual([
      'class-resource-choice'
    ])
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
  it('clears chosen grant selections with their owning source', () => {
    const values = toCharacterFormValues(characterBuilderPayloadFixture)
    values.intent.chosenGrantSelections = [
      createChosenGrantSelection('race', { kind: 'RACE', raceId: 'race-elf' }),
      createChosenGrantSelection('subrace', { kind: 'SUBRACE', subraceId: 'subrace-sea-elf' }),
      createChosenGrantSelection('ancestry', {
        kind: 'ANCESTRY',
        ancestryId: 'ancestry-elf',
        optionId: 'ancestry-ocean'
      }),
      createChosenGrantSelection('class', {
        kind: 'CLASS',
        classId: 'class-wizard',
        classLevel: 1
      }),
      createChosenGrantSelection('subclass', {
        kind: 'SUBCLASS',
        subclassId: 'subclass-scribe',
        classLevel: 1
      }),
      createChosenGrantSelection('background', {
        kind: 'BACKGROUND',
        backgroundId: 'background-sage'
      })
    ]

    expect(
      clearRaceDependents(values).intent.chosenGrantSelections?.map((selection) => selection.id)
    ).toEqual(['class', 'subclass', 'background'])
    expect(
      clearClassOwnedChoices(values, values.intent.classes[0]).intent.chosenGrantSelections?.map(
        (selection) => selection.id
      )
    ).toEqual(['race', 'subrace', 'ancestry', 'background'])
    expect(
      clearSubclassOwnedChoices(values, values.intent.classes[0]).intent.chosenGrantSelections?.map(
        (selection) => selection.id
      )
    ).toEqual(['race', 'subrace', 'ancestry', 'class', 'background'])
    expect(
      clearBackgroundDependents(values).intent.chosenGrantSelections?.map(
        (selection) => selection.id
      )
    ).toEqual(['race', 'subrace', 'ancestry', 'class', 'subclass'])
  })
})

function createChosenGrantSelection(
  id: string,
  source: NonNullable<
    ReturnType<typeof toCharacterFormValues>['intent']['chosenGrantSelections']
  >[number]['source']
): NonNullable<
  ReturnType<typeof toCharacterFormValues>['intent']['chosenGrantSelections']
>[number] {
  return {
    id,
    grantId: 'grant-' + id,
    source,
    timing: { kind: 'IMMEDIATE' },
    targetIds: ['target-' + id]
  }
}
