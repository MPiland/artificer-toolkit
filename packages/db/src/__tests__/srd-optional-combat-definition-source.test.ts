import {
  DND5E_ALTERNATING_DIAGONALS_DEFINITION_ID,
  DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY,
  DND5E_CLEAVING_DEFINITION_ID,
  DND5E_CLEAVING_OPERATION_KEY,
  DND5E_CLIMB_ONTO_LARGER_CREATURE_DEFINITION_ID,
  DND5E_CLIMB_ONTO_LARGER_CREATURE_OPERATION_KEY,
  DND5E_DISARM_DEFINITION_ID,
  DND5E_DISARM_OPERATION_KEY,
  DND5E_FLANKING_DEFINITION_ID,
  DND5E_FLANKING_OPERATION_KEY,
  DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID,
  DND5E_FACING_DEFINITION_ID,
  DND5E_FACING_OPERATION_KEY,
  DND5E_HITTING_COVER_DEFINITION_ID,
  DND5E_HITTING_COVER_OPERATION_KEY,
  DND5E_INJURIES_DEFINITION_ID,
  DND5E_INJURIES_OPERATION_KEY,
  DND5E_MARK_DEFINITION_ID,
  DND5E_MARK_OPERATION_KEY,
  DND5E_MASSIVE_DAMAGE_DEFINITION_ID,
  DND5E_MASSIVE_DAMAGE_OPERATION_KEY,
  DND5E_MORALE_DEFINITION_ID,
  DND5E_MORALE_OPERATION_KEY,
  DND5E_OVERRUN_DEFINITION_ID,
  DND5E_OVERRUN_OPERATION_KEY,
  DND5E_SHOVE_ASIDE_DEFINITION_ID,
  DND5E_SHOVE_ASIDE_OPERATION_KEY,
  DND5E_TUMBLE_DEFINITION_ID,
  DND5E_TUMBLE_OPERATION_KEY,
  dnd5eOptionalCombatOperationDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { describe, expect, it } from 'vitest'

import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '../source-data/srd/optionalCombat.js'
import {
  SRD_ACROBATICS_SKILL_ID,
  SRD_ABILITY_DEFINITION_IDS,
  SRD_ATHLETICS_SKILL_ID,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '../source-data/srd/vocabulary.js'

const expectedDefinitions = [
  {
    id: DND5E_ALTERNATING_DIAGONALS_DEFINITION_ID,
    kind: 'ALTERNATING_DIAGONALS',
    operationKey: DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY
  },
  {
    id: DND5E_FLANKING_DEFINITION_ID,
    kind: 'FLANKING',
    operationKey: DND5E_FLANKING_OPERATION_KEY,
    parameters: {
      participantCapabilityDefinitionId: DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID
    }
  },
  { id: DND5E_FACING_DEFINITION_ID, kind: 'FACING', operationKey: DND5E_FACING_OPERATION_KEY },
  {
    id: DND5E_CLIMB_ONTO_LARGER_CREATURE_DEFINITION_ID,
    kind: 'CLIMB_ONTO_LARGER_CREATURE',
    operationKey: DND5E_CLIMB_ONTO_LARGER_CREATURE_OPERATION_KEY
  },
  {
    id: DND5E_DISARM_DEFINITION_ID,
    kind: 'DISARM',
    operationKey: DND5E_DISARM_OPERATION_KEY,
    parameters: {
      defenderCheckDefinitionIds: [SRD_ATHLETICS_SKILL_ID, SRD_ACROBATICS_SKILL_ID]
    }
  },
  { id: DND5E_MARK_DEFINITION_ID, kind: 'MARK', operationKey: DND5E_MARK_OPERATION_KEY },
  {
    id: DND5E_OVERRUN_DEFINITION_ID,
    kind: 'OVERRUN',
    operationKey: DND5E_OVERRUN_OPERATION_KEY,
    parameters: {
      initiatorCheckDefinitionId: SRD_ATHLETICS_SKILL_ID,
      targetCheckDefinitionId: SRD_ATHLETICS_SKILL_ID
    }
  },
  {
    id: DND5E_SHOVE_ASIDE_DEFINITION_ID,
    kind: 'SHOVE_ASIDE',
    operationKey: DND5E_SHOVE_ASIDE_OPERATION_KEY,
    parameters: {
      initiatorCheckDefinitionId: SRD_ATHLETICS_SKILL_ID,
      defenderCheckDefinitionIds: [SRD_ATHLETICS_SKILL_ID, SRD_ACROBATICS_SKILL_ID]
    }
  },
  {
    id: DND5E_TUMBLE_DEFINITION_ID,
    kind: 'TUMBLE',
    operationKey: DND5E_TUMBLE_OPERATION_KEY,
    parameters: {
      initiatorCheckDefinitionId: SRD_ACROBATICS_SKILL_ID,
      targetCheckDefinitionId: SRD_ACROBATICS_SKILL_ID
    }
  },
  {
    id: DND5E_HITTING_COVER_DEFINITION_ID,
    kind: 'HITTING_COVER',
    operationKey: DND5E_HITTING_COVER_OPERATION_KEY
  },
  {
    id: DND5E_CLEAVING_DEFINITION_ID,
    kind: 'CLEAVING',
    operationKey: DND5E_CLEAVING_OPERATION_KEY
  },
  {
    id: DND5E_INJURIES_DEFINITION_ID,
    kind: 'INJURIES',
    operationKey: DND5E_INJURIES_OPERATION_KEY
  },
  {
    id: DND5E_MASSIVE_DAMAGE_DEFINITION_ID,
    kind: 'MASSIVE_DAMAGE',
    operationKey: DND5E_MASSIVE_DAMAGE_OPERATION_KEY
  },
  { id: DND5E_MORALE_DEFINITION_ID, kind: 'MORALE', operationKey: DND5E_MORALE_OPERATION_KEY }
] as const

describe('SRD optional combat definition source', () => {
  it('provides all fourteen canonical optional-combat definitions with strict module and parameter pins', () => {
    expect(SRD_OPTIONAL_COMBAT_DEFINITIONS).toHaveLength(14)
    expect(
      new Set(SRD_OPTIONAL_COMBAT_DEFINITIONS.map((definition) => definition.id))
    ).toHaveLength(14)
    expect(
      new Set(SRD_OPTIONAL_COMBAT_DEFINITIONS.map((definition) => definition.document.kind))
    ).toHaveLength(14)
    expect(
      new Set(
        SRD_OPTIONAL_COMBAT_DEFINITIONS.map(
          (definition) => definition.document.module.policyModuleKey
        )
      )
    ).toHaveLength(14)

    for (const expected of expectedDefinitions) {
      const definition = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
        (candidate) => candidate.id === expected.id
      )
      expect(definition).toBeDefined()
      expect(definition).toMatchObject({
        definitionFamilyKey: 'dnd5e-optional-combat',
        document: {
          id: expected.id,
          gameSystemId: SRD_SYSTEM_ID,
          kind: expected.kind,
          module: { policyModuleKey: expected.operationKey, contractVersion: 1 },
          parameters: { kind: expected.kind },
          mutuallyExclusiveGroup: null
        }
      })
      if ('parameters' in expected) {
        expect(definition!.document.parameters).toMatchObject(expected.parameters)
      }
      expect(definition!.checksum).toBe(checksumRuleDocument(definition!.document))
    }
  })

  it('keeps optional-resolution thresholds, ability identities, and consequence children in UUID-backed source data', () => {
    const byKind = Object.fromEntries(
      SRD_OPTIONAL_COMBAT_DEFINITIONS.map((definition) => [definition.document.kind, definition])
    )
    const hittingCover = byKind.HITTING_COVER!.document.parameters
    const cleaving = byKind.CLEAVING!.document.parameters
    const injuries = byKind.INJURIES!.document.parameters
    const massiveDamage = byKind.MASSIVE_DAMAGE!.document.parameters
    const morale = byKind.MORALE!.document.parameters

    expect(hittingCover).toMatchObject({
      kind: 'HITTING_COVER',
      qualifyingAttackKind: 'RANGED',
      redirectCoverProviderKinds: ['CREATURE'],
      redirectRequiresStrictAttackTotalOverProviderArmorClass: true
    })
    expect(cleaving).toMatchObject({
      kind: 'CLEAVING',
      qualifyingAttackKind: 'MELEE',
      requiresUndamagedInitialTarget: true
    })
    expect(massiveDamage).toMatchObject({
      kind: 'MASSIVE_DAMAGE',
      threshold: { numerator: 1, denominator: 2 },
      savingThrowAbilityDefinitionId: '00000000-0000-0000-0011-000300000000',
      savingThrowDifficultyClass: 15
    })
    expect(morale).toMatchObject({
      kind: 'MORALE',
      savingThrowAbilityDefinitionId: '00000000-0000-0000-0011-000500000000',
      savingThrowDifficultyClass: 10,
      requiresGroupLeaderOrFallback: true
    })
    if (
      injuries.kind !== 'INJURIES' ||
      massiveDamage.kind !== 'MASSIVE_DAMAGE' ||
      morale.kind !== 'MORALE'
    ) {
      throw new Error('Unexpected optional combat parameter arm.')
    }
    const injuryOutcomeIds = injuries.bands.map((band) => band.outcome.id)
    const injuryRecoveryIds = injuries.bands.flatMap((band) =>
      band.recovery === null ? [] : [band.recovery.id]
    )
    expect(new Set(injuryOutcomeIds).size).toBe(injuryOutcomeIds.length)
    expect(new Set(injuryRecoveryIds).size).toBe(injuryRecoveryIds.length)
    expect(massiveDamage.bands.map((band) => band.outcome.id)).toEqual([
      '00000000-0000-4000-8000-000000000141',
      '00000000-0000-4000-8000-000000000142',
      '00000000-0000-4000-8000-000000000143',
      '00000000-0000-4000-8000-000000000144',
      '00000000-0000-4000-8000-000000000145'
    ])
    expect(
      massiveDamage.bands.map((band) =>
        band.outcome.operations.map((operation) => operation.primitive)
      )
    ).toEqual([
      ['SET_HIT_POINTS'],
      ['SET_HIT_POINTS', 'SET_STABLE'],
      ['APPLY_CONDITION'],
      ['SET_REACTION_AVAILABILITY', 'APPLY_ROLL_MODE'],
      ['SET_REACTION_AVAILABILITY']
    ])
    expect(massiveDamage.bands.slice(3).flatMap((band) => band.outcome.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          primitive: 'SET_REACTION_AVAILABILITY',
          duration: 'UNTIL_END_OF_NEXT_TURN',
          available: false
        })
      ])
    )
    expect(massiveDamage.bands[3]!.outcome.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          primitive: 'APPLY_ROLL_MODE',
          rollContexts: ['ATTACK_ROLL', 'ABILITY_CHECK'],
          duration: 'UNTIL_END_OF_NEXT_TURN'
        })
      ])
    )
    expect(injuries.bands.every((band) => band.outcome.operations.length > 0)).toBe(true)
    expect(
      injuries.bands
        .filter((band) => band.recovery?.kind === 'NONE')
        .every((band) => band.recovery?.operations.length === 0)
    ).toBe(true)
    expect(
      injuries.bands
        .filter((band) => band.recovery?.kind !== 'NONE')
        .every((band) => band.recovery !== null && band.recovery.operations.length > 0)
    ).toBe(true)

    const internalInjury = injuries.bands.find((band) => band.outcome.kind === 'INTERNAL_INJURY')
    expect(internalInjury?.outcome.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          primitive: 'REQUIRE_CHECK',
          abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION,
          difficultyClass: 15,
          trigger: 'BEFORE_COMBAT_ACTION',
          successEffects: [
            { effect: 'RETAIN_INJURY' },
            { effect: 'ALLOW_ATTEMPTED_COMBAT_ACTION' }
          ],
          failureEffects: [
            { effect: 'RETAIN_INJURY' },
            { effect: 'DENY_AND_LOSE_ATTEMPTED_COMBAT_ACTION' },
            {
              effect: 'SET_REACTION_AVAILABILITY',
              available: false,
              duration: 'UNTIL_START_OF_NEXT_TURN'
            }
          ]
        })
      ])
    )

    const knownConditionIds = new Set(SRD_CONDITION_TYPES.map((condition) => condition.id))
    const knownAbilityIds = new Set(Object.values(SRD_ABILITY_DEFINITION_IDS))
    const knownInjuryIds = new Set(injuries.bands.map((band) => band.outcome.id))
    const allOperations = [
      ...injuries.bands.flatMap((band) => [
        ...band.outcome.operations,
        ...(band.recovery?.operations ?? [])
      ]),
      ...massiveDamage.bands.flatMap((band) => band.outcome.operations),
      ...morale.individualOutcomes.flatMap((outcome) => outcome.operations),
      ...morale.groupOutcomes.flatMap((outcome) => outcome.operations)
    ]
    for (const operation of allOperations) {
      expect(dnd5eOptionalCombatOperationDtoSchema.parse(operation)).toEqual(operation)
      if (operation.primitive === 'APPLY_CONDITION') {
        expect(knownConditionIds.has(operation.conditionDefinitionId)).toBe(true)
      }
      if (operation.primitive === 'REQUIRE_CHECK') {
        expect(knownAbilityIds.has(operation.abilityDefinitionId)).toBe(true)
      }
      if (operation.primitive === 'CREATE_INJURY_RECORD') {
        expect(knownInjuryIds.has(operation.injuryDefinitionId)).toBe(true)
      }
    }
  })
})
