import {
  DND5E_CLEAVING_DEFINITION_ID,
  DND5E_CLEAVING_OPERATION_KEY,
  DND5E_HITTING_COVER_DEFINITION_ID,
  DND5E_HITTING_COVER_OPERATION_KEY,
  DND5E_INJURIES_DEFINITION_ID,
  DND5E_INJURIES_OPERATION_KEY,
  DND5E_MASSIVE_DAMAGE_DEFINITION_ID,
  DND5E_MASSIVE_DAMAGE_OPERATION_KEY,
  DND5E_MORALE_DEFINITION_ID,
  DND5E_MORALE_OPERATION_KEY,
  encounterOptionalCombatSnapshotDtoSchema,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { describe, expect, it } from 'vitest'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import {
  MAX_DND5E_CLEAVING_TARGETS,
  resolveDnd5eCleaving,
  resolveDnd5eHittingCover,
  resolveDnd5eInjury,
  resolveDnd5eMassiveDamage,
  resolveDnd5eMorale
} from './optionalResolutionPolicy.js'

const ACTOR_A = '00000000-0000-4000-8000-0000000000a1'
const ACTOR_B = '00000000-0000-4000-8000-0000000000a2'
const ACTOR_C = '00000000-0000-4000-8000-0000000000a3'
const ACTOR_D = '00000000-0000-4000-8000-0000000000a4'
const CONSTITUTION_ID = '00000000-0000-0000-0011-000300000000'
const WISDOM_ID = '00000000-0000-0000-0011-000500000000'

function outcome(
  id: string,
  kind:
    | 'DROP_TO_ZERO'
    | 'STABLE_AT_ZERO'
    | 'STUNNED_UNTIL_END_OF_NEXT_TURN'
    | 'IMPAIRED_UNTIL_END_OF_NEXT_TURN'
    | 'REACTIONS_SUPPRESSED_UNTIL_END_OF_NEXT_TURN'
    | 'LOSE_EYE'
    | 'MINOR_SCAR'
    | 'CONTINUE'
    | 'FLEE'
    | 'SURRENDER'
) {
  return {
    id,
    kind,
    operations:
      kind === 'CONTINUE' || kind === 'FLEE' || kind === 'SURRENDER'
        ? [
            {
              id,
              primitive: 'SET_MORALE_DISPOSITION' as const,
              target: 'GROUP' as const,
              disposition: kind,
              duration: null
            }
          ]
        : [
            {
              id,
              primitive: 'CREATE_INJURY_RECORD' as const,
              target: 'SUBJECT' as const,
              injuryDefinitionId: id,
              duration: 'UNTIL_CLEARED' as const
            }
          ]
  }
}

function recovery(id: string, kind: 'MAGICAL_RESTORATION' | 'NONE') {
  return {
    id,
    kind,
    operations:
      kind === 'NONE'
        ? []
        : [
            {
              id,
              primitive: 'JUDGMENT_REQUIRED' as const,
              target: 'SUBJECT' as const,
              reason: 'UNNORMALIZED_RECOVERY' as const
            }
          ]
  }
}

function moraleOutcome(
  id: string,
  kind: 'CONTINUE' | 'FLEE' | 'SURRENDER',
  target: 'SUBJECT' | 'GROUP'
) {
  return {
    id,
    kind,
    operations: [
      {
        id,
        primitive: 'SET_MORALE_DISPOSITION' as const,
        target,
        disposition: kind,
        duration: null
      }
    ]
  }
}

const definitionByKind = {
  HITTING_COVER: {
    id: DND5E_HITTING_COVER_DEFINITION_ID,
    key: DND5E_HITTING_COVER_OPERATION_KEY,
    parameters: {
      kind: 'HITTING_COVER',
      qualifyingAttackKind: 'RANGED',
      redirectCoverProviderKinds: ['CREATURE'],
      redirectRequiresStrictAttackTotalOverProviderArmorClass: true
    }
  },
  CLEAVING: {
    id: DND5E_CLEAVING_DEFINITION_ID,
    key: DND5E_CLEAVING_OPERATION_KEY,
    parameters: {
      kind: 'CLEAVING',
      qualifyingAttackKind: 'MELEE',
      requiresUndamagedInitialTarget: true
    }
  },
  MASSIVE_DAMAGE: {
    id: DND5E_MASSIVE_DAMAGE_DEFINITION_ID,
    key: DND5E_MASSIVE_DAMAGE_OPERATION_KEY,
    parameters: {
      kind: 'MASSIVE_DAMAGE',
      threshold: { numerator: 1, denominator: 2 },
      savingThrowAbilityDefinitionId: CONSTITUTION_ID,
      savingThrowDifficultyClass: 15,
      bands: [
        {
          minimum: 1,
          maximum: 1,
          outcome: outcome('00000000-0000-4000-8000-000000000141', 'DROP_TO_ZERO'),
          recovery: null
        },
        {
          minimum: 2,
          maximum: 3,
          outcome: outcome('00000000-0000-4000-8000-000000000142', 'STABLE_AT_ZERO'),
          recovery: null
        },
        {
          minimum: 4,
          maximum: 5,
          outcome: outcome(
            '00000000-0000-4000-8000-000000000143',
            'STUNNED_UNTIL_END_OF_NEXT_TURN'
          ),
          recovery: null
        },
        {
          minimum: 6,
          maximum: 7,
          outcome: outcome(
            '00000000-0000-4000-8000-000000000144',
            'IMPAIRED_UNTIL_END_OF_NEXT_TURN'
          ),
          recovery: null
        },
        {
          minimum: 8,
          maximum: 10,
          outcome: outcome(
            '00000000-0000-4000-8000-000000000145',
            'REACTIONS_SUPPRESSED_UNTIL_END_OF_NEXT_TURN'
          ),
          recovery: null
        }
      ]
    }
  },
  INJURIES: {
    id: DND5E_INJURIES_DEFINITION_ID,
    key: DND5E_INJURIES_OPERATION_KEY,
    parameters: {
      kind: 'INJURIES',
      triggerKinds: ['CRITICAL_HIT', 'DROP_TO_ZERO', 'FAIL_DEATH_SAVE_BY_FIVE_OR_MORE'],
      bands: [
        {
          minimum: 1,
          maximum: 1,
          outcome: outcome('00000000-0000-4000-8000-000000000121', 'LOSE_EYE'),
          recovery: recovery('00000000-0000-4000-8000-000000000131', 'MAGICAL_RESTORATION')
        },
        {
          minimum: 2,
          maximum: 4,
          outcome: outcome('00000000-0000-4000-8000-000000000129', 'MINOR_SCAR'),
          recovery: recovery('00000000-0000-4000-8000-000000000139', 'NONE')
        },
        {
          minimum: 5,
          maximum: 20,
          outcome: {
            id: '00000000-0000-4000-8000-000000000125',
            kind: 'INTERNAL_INJURY',
            operations: [
              {
                id: '00000000-0000-4000-8000-000000000270',
                primitive: 'REQUIRE_CHECK' as const,
                target: 'SUBJECT' as const,
                abilityDefinitionId: CONSTITUTION_ID,
                difficultyClass: 15,
                trigger: 'BEFORE_COMBAT_ACTION' as const,
                successEffects: [
                  { effect: 'RETAIN_INJURY' as const },
                  { effect: 'ALLOW_ATTEMPTED_COMBAT_ACTION' as const }
                ],
                failureEffects: [
                  { effect: 'RETAIN_INJURY' as const },
                  { effect: 'DENY_AND_LOSE_ATTEMPTED_COMBAT_ACTION' as const },
                  {
                    effect: 'SET_REACTION_AVAILABILITY' as const,
                    available: false,
                    duration: 'UNTIL_START_OF_NEXT_TURN' as const
                  }
                ]
              }
            ]
          },
          recovery: recovery('00000000-0000-4000-8000-000000000135', 'MAGICAL_RESTORATION')
        }
      ]
    }
  },
  MORALE: {
    id: DND5E_MORALE_DEFINITION_ID,
    key: DND5E_MORALE_OPERATION_KEY,
    parameters: {
      kind: 'MORALE',
      triggerKinds: [
        'INDIVIDUAL_SURPRISED',
        'INDIVIDUAL_REDUCED_TO_HALF',
        'INDIVIDUAL_CANNOT_HARM_OPPOSITION',
        'GROUP_SURPRISED',
        'GROUP_HALF_REMOVED',
        'GROUP_LEADER_REMOVED',
        'GROUP_LEADER_INCAPACITATED',
        'GROUP_LEADER_TAKEN_PRISONER'
      ],
      savingThrowAbilityDefinitionId: WISDOM_ID,
      savingThrowDifficultyClass: 10,
      requiresGroupLeaderOrFallback: true,
      overwhelmingOpposition: { rollMode: 'DISADVANTAGE', automaticFailure: false },
      individualOutcomes: [
        moraleOutcome('00000000-0000-4000-8000-000000000151', 'CONTINUE', 'SUBJECT'),
        moraleOutcome('00000000-0000-4000-8000-000000000152', 'FLEE', 'SUBJECT'),
        moraleOutcome('00000000-0000-4000-8000-000000000153', 'SURRENDER', 'SUBJECT')
      ],
      groupOutcomes: [
        moraleOutcome('00000000-0000-4000-8000-000000000161', 'CONTINUE', 'GROUP'),
        moraleOutcome('00000000-0000-4000-8000-000000000162', 'FLEE', 'GROUP'),
        moraleOutcome('00000000-0000-4000-8000-000000000163', 'SURRENDER', 'GROUP')
      ]
    }
  }
} as const

function snapshot(kind: keyof typeof definitionByKind): EncounterOptionalCombatSnapshotDto {
  const selected = definitionByKind[kind]
  const document = {
    schemaVersion: 1 as const,
    kind,
    id: selected.id,
    gameSystemId: DND5E_SYSTEM_ID,
    module: { policyModuleKey: selected.key, contractVersion: 1 },
    parameters: selected.parameters,
    mutuallyExclusiveGroup: null
  }
  return encounterOptionalCombatSnapshotDtoSchema.parse({
    schemaVersion: 1,
    gameSystemId: DND5E_SYSTEM_ID,
    definitions: [
      {
        definitionId: selected.id,
        contentSourceId: '00000000-0000-4000-8000-0000000000b1',
        definitionVersion: 1,
        definitionChecksum: checksumRuleDocument(document),
        contractVersion: 1,
        label: kind,
        document
      }
    ]
  })
}

function base(
  kind: keyof typeof definitionByKind,
  automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL' = 'AUTOMATIC'
) {
  const optionalCombatSnapshot = snapshot(kind)
  return {
    automationMode,
    gameSystemId: DND5E_SYSTEM_ID,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumRuleDocument(optionalCombatSnapshot)
  } as const
}

describe('D&D optional resolution policies', () => {
  it('redirects only a qualifying ranged near-miss through one creature cover provider using strict provider AC', () => {
    const input = {
      ...base('HITTING_COVER'),
      attackKind: 'RANGED' as const,
      attackTotal: 13,
      attackResolution: {
        naturalRoll: 13,
        missedBecauseOfCover: true,
        wouldHitProtectedTargetWithoutCover: true
      },
      coveredTargetArmorClass: 14,
      coveredTargetActorId: ACTOR_A,
      coverProviders: [{ kind: 'CREATURE' as const, actorId: ACTOR_B, armorClass: 12 }]
    }
    expect(resolveDnd5eHittingCover(input)).toMatchObject({
      kind: 'PROPOSED',
      proposal: { redirect: 'COVER_PROVIDER', coverProviderActorId: ACTOR_B, attackTotal: 13 }
    })
    expect(
      resolveDnd5eHittingCover({
        ...input,
        attackResolution: { ...input.attackResolution, missedBecauseOfCover: false }
      })
    ).toEqual({
      kind: 'NOT_APPLICABLE'
    })
    expect(
      resolveDnd5eHittingCover({
        ...input,
        attackResolution: { ...input.attackResolution, wouldHitProtectedTargetWithoutCover: false }
      })
    ).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'CONTRADICTORY_HITTING_COVER_RESOLUTION'
    })
    expect(
      resolveDnd5eHittingCover({
        ...input,
        attackResolution: {
          naturalRoll: 1,
          missedBecauseOfCover: false,
          wouldHitProtectedTargetWithoutCover: false
        }
      })
    ).toEqual({ kind: 'NOT_APPLICABLE' })
    expect(
      resolveDnd5eHittingCover({
        ...input,
        attackResolution: {
          naturalRoll: 20,
          missedBecauseOfCover: false,
          wouldHitProtectedTargetWithoutCover: true
        }
      })
    ).toEqual({ kind: 'NOT_APPLICABLE' })
    expect(
      resolveDnd5eHittingCover({
        ...input,
        coverProviders: [{ kind: 'BARRIER', actorId: null, armorClass: null }]
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'UNSUPPORTED_COVER_PROVIDER' })
  })

  it('keeps cover definition currentness exact and all resolution policies inert in Manual', () => {
    const input = {
      ...base('HITTING_COVER'),
      attackKind: 'RANGED' as const,
      attackTotal: 13,
      attackResolution: {
        naturalRoll: 13,
        missedBecauseOfCover: true,
        wouldHitProtectedTargetWithoutCover: true
      },
      coveredTargetArmorClass: 14,
      coveredTargetActorId: ACTOR_A,
      coverProviders: [{ kind: 'CREATURE' as const, actorId: ACTOR_B, armorClass: 12 }]
    }
    expect(
      resolveDnd5eHittingCover({ ...input, optionalCombatSnapshotChecksum: '0'.repeat(64) })
    ).toEqual({
      kind: 'INERT'
    })
    expect(resolveDnd5eHittingCover({ ...input, automationMode: 'MANUAL' })).toEqual({
      kind: 'INERT'
    })
  })

  it('proposes one bounded cleave only for a strict melee hit and reports ambiguous damage or a missing choice', () => {
    const input = {
      ...base('CLEAVING'),
      attackKind: 'MELEE' as const,
      attackTotal: 15,
      attackerActorId: ACTOR_A,
      initialTargetActorId: ACTOR_B,
      eligibleTargetActorIds: [ACTOR_C],
      initialTargetReducedToZero: true,
      initialTargetWasUndamaged: true,
      mixedDamageOrRiderAmbiguity: false,
      chainStep: 0,
      remainingFinalDamage: 6,
      visitedTargetActorIds: [ACTOR_B],
      nextTarget: {
        actorId: ACTOR_C,
        armorClass: 15,
        withinAttackerReach: true,
        originalAttackResolution: { naturalRoll: 13, originalAttackCanHitNextTarget: true }
      }
    }
    expect(resolveDnd5eCleaving(input)).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        nextTargetActorId: ACTOR_C,
        chainStep: 1,
        eligibleTargetActorIds: [ACTOR_C],
        remainingFinalDamage: 6,
        visitedTargetActorIds: [ACTOR_B, ACTOR_C]
      }
    })
    expect(resolveDnd5eCleaving({ ...input, nextTarget: null })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'CLEAVING_TARGET_REQUIRED'
    })
    expect(resolveDnd5eCleaving({ ...input, mixedDamageOrRiderAmbiguity: true })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'AMBIGUOUS_CLEAVING_DAMAGE'
    })
    expect(resolveDnd5eCleaving({ ...input, chainStep: 20 })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'MISSING_CLEAVING_FACTS'
    })
    expect(
      resolveDnd5eCleaving({
        ...input,
        nextTarget: {
          ...input.nextTarget,
          armorClass: 30,
          originalAttackResolution: { naturalRoll: 20, originalAttackCanHitNextTarget: true }
        }
      })
    ).toMatchObject({ kind: 'PROPOSED' })
    expect(
      resolveDnd5eCleaving({
        ...input,
        nextTarget: {
          ...input.nextTarget,
          originalAttackResolution: { naturalRoll: 1, originalAttackCanHitNextTarget: false }
        }
      })
    ).toEqual({ kind: 'NOT_APPLICABLE' })

    expect(
      resolveDnd5eCleaving({
        ...input,
        nextTarget: { ...input.nextTarget, actorId: '00000000-0000-4000-8000-0000000000d1' }
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_CLEAVING_TARGET_FACTS' })
    expect(
      resolveDnd5eCleaving({
        ...input,
        eligibleTargetActorIds: [ACTOR_C, '00000000-0000-4000-8000-0000000000d1'],
        visitedTargetActorIds: [ACTOR_B, ACTOR_C],
        chainStep: 1
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_CLEAVING_TARGET_FACTS' })
    expect(resolveDnd5eCleaving({ ...input, eligibleTargetActorIds: [ACTOR_D, ACTOR_C] })).toEqual(
      resolveDnd5eCleaving({ ...input, eligibleTargetActorIds: [ACTOR_C, ACTOR_D] })
    )
    expect(resolveDnd5eCleaving({ ...input, eligibleTargetActorIds: [ACTOR_B] })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'MISSING_CLEAVING_FACTS'
    })
    const maximumCandidates = Array.from(
      { length: MAX_DND5E_CLEAVING_TARGETS },
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
    )
    const reverseMaximumCandidates = [...maximumCandidates].reverse()
    expect(
      resolveDnd5eCleaving({
        ...input,
        eligibleTargetActorIds: reverseMaximumCandidates,
        nextTarget: { ...input.nextTarget, actorId: maximumCandidates[0]! }
      })
    ).toMatchObject({
      kind: 'PROPOSED',
      proposal: { eligibleTargetActorIds: [...maximumCandidates].sort() }
    })
    expect(
      resolveDnd5eCleaving({
        ...input,
        eligibleTargetActorIds: maximumCandidates,
        visitedTargetActorIds: [ACTOR_B, ...maximumCandidates],
        chainStep: MAX_DND5E_CLEAVING_TARGETS,
        nextTarget: null
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'CLEAVING_TARGET_REQUIRED' })
    expect(
      resolveDnd5eCleaving({
        ...input,
        eligibleTargetActorIds: maximumCandidates,
        visitedTargetActorIds: [ACTOR_B, ...maximumCandidates, ACTOR_D],
        chainStep: MAX_DND5E_CLEAVING_TARGETS + 1
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_CLEAVING_FACTS' })
    expect(
      resolveDnd5eCleaving({
        ...input,
        eligibleTargetActorIds: Array.from(
          { length: MAX_DND5E_CLEAVING_TARGETS + 1 },
          (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
        )
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_CLEAVING_FACTS' })
  })

  it('reads massive-damage threshold, Constitution and consequence identity from the selected definition', () => {
    const input = {
      ...base('MASSIVE_DAMAGE'),
      damageSourceCount: 1,
      finalizedAppliedDamage: 10,
      maximumHitPoints: 20,
      savingThrow: { abilityDefinitionId: CONSTITUTION_ID, total: 14 },
      tableRoll: 4
    }
    expect(resolveDnd5eMassiveDamage(input)).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        consequence: {
          id: '00000000-0000-4000-8000-000000000143',
          kind: 'STUNNED_UNTIL_END_OF_NEXT_TURN'
        }
      }
    })
    expect(resolveDnd5eMassiveDamage({ ...input, finalizedAppliedDamage: 9 })).toEqual({
      kind: 'NOT_APPLICABLE'
    })
    expect(
      resolveDnd5eMassiveDamage({
        ...input,
        savingThrow: { abilityDefinitionId: CONSTITUTION_ID, total: 15 }
      })
    ).toEqual({
      kind: 'NOT_APPLICABLE'
    })
    expect(resolveDnd5eMassiveDamage({ ...input, damageSourceCount: 2 })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'MULTIPLE_DAMAGE_SOURCES'
    })
    for (const [tableRoll, consequenceKind] of [
      [1, 'DROP_TO_ZERO'],
      [2, 'STABLE_AT_ZERO'],
      [3, 'STABLE_AT_ZERO'],
      [4, 'STUNNED_UNTIL_END_OF_NEXT_TURN'],
      [5, 'STUNNED_UNTIL_END_OF_NEXT_TURN'],
      [6, 'IMPAIRED_UNTIL_END_OF_NEXT_TURN'],
      [7, 'IMPAIRED_UNTIL_END_OF_NEXT_TURN'],
      [8, 'REACTIONS_SUPPRESSED_UNTIL_END_OF_NEXT_TURN'],
      [9, 'REACTIONS_SUPPRESSED_UNTIL_END_OF_NEXT_TURN'],
      [10, 'REACTIONS_SUPPRESSED_UNTIL_END_OF_NEXT_TURN']
    ] as const) {
      expect(resolveDnd5eMassiveDamage({ ...input, tableRoll })).toMatchObject({
        kind: 'PROPOSED',
        proposal: { consequence: { kind: consequenceKind } }
      })
    }
    expect(resolveDnd5eMassiveDamage({ ...input, tableRoll: 4.5 })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'MISSING_MASSIVE_DAMAGE_SAVE_FACTS'
    })
    expect(resolveDnd5eMassiveDamage({ ...input, tableRoll: 11 })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'INVALID_MASSIVE_DAMAGE_TABLE_ROLL'
    })
  })

  it('requires an authorized injury trigger and supported anatomy/recovery before resolving UUID-backed consequences', () => {
    const input = {
      ...base('INJURIES'),
      trigger: { kind: 'CRITICAL_HIT' as const, authorized: true },
      tableRoll: 1,
      anatomy: 'SUPPORTED' as const,
      recoveryContext: 'SUPPORTED' as const
    }
    expect(resolveDnd5eInjury(input)).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        consequence: { id: '00000000-0000-4000-8000-000000000121', kind: 'LOSE_EYE' },
        recovery: { id: '00000000-0000-4000-8000-000000000131' }
      }
    })
    expect(resolveDnd5eInjury({ ...input, anatomy: 'UNSUPPORTED' })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'INJURY_ANATOMY_UNRESOLVED'
    })
    expect(
      resolveDnd5eInjury({ ...input, trigger: { kind: 'CRITICAL_HIT', authorized: false } })
    ).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'INJURY_TRIGGER_NOT_AUTHORIZED'
    })
    expect(resolveDnd5eInjury({ ...input, tableRoll: 1.5 })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'MISSING_INJURY_FACTS'
    })
    expect(resolveDnd5eInjury({ ...input, tableRoll: 5 })).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        consequence: {
          kind: 'INTERNAL_INJURY',
          operations: [
            {
              primitive: 'REQUIRE_CHECK',
              abilityDefinitionId: CONSTITUTION_ID,
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
            }
          ]
        }
      }
    })
  })

  it('derives Continue/Flee/Surrender from the pinned Wisdom DC and leaves route or terms to judgment', () => {
    const input = {
      ...base('MORALE'),
      trigger: {
        kind: 'GROUP_HALF_REMOVED' as const,
        scope: 'GROUP' as const,
        fact: 'HALF_PARTICIPANTS_REMOVED' as const,
        satisfied: true as const,
        opposingSideHasLosses: false as const
      },
      leaderOrFallback: {
        selectedActorId: ACTOR_A,
        selection: {
          kind: 'LEADER' as const,
          leaderActorId: ACTOR_A,
          leaderIsEligible: true as const
        },
        savingThrowAbilityDefinitionId: WISDOM_ID,
        savingThrowTotal: 9
      },
      individualSavingThrow: null,
      overwhelmingOpposition: false,
      escapePossible: true
    } satisfies Parameters<typeof resolveDnd5eMorale>[0]
    expect(resolveDnd5eMorale(input)).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        resolution: {
          kind: 'FLEE',
          operations: [
            expect.objectContaining({ primitive: 'SET_MORALE_DISPOSITION', target: 'GROUP' })
          ]
        },
        evidence: { rollerKind: 'LEADER_OR_FALLBACK', rollerActorId: ACTOR_A },
        routeOrTerms: 'JUDGMENT_REQUIRED'
      }
    })
    expect(resolveDnd5eMorale({ ...input, overwhelmingOpposition: true })).toMatchObject({
      kind: 'PROPOSED',
      proposal: { resolution: { kind: 'FLEE' }, evidence: { rollMode: 'DISADVANTAGE' } }
    })
    expect(resolveDnd5eMorale({ ...input, escapePossible: false })).toMatchObject({
      kind: 'PROPOSED',
      proposal: { resolution: { kind: 'SURRENDER' } }
    })
    expect(
      resolveDnd5eMorale({
        ...input,
        leaderOrFallback: {
          selectedActorId: ACTOR_A,
          selection: { kind: 'LEADER', leaderActorId: ACTOR_A, leaderIsEligible: true },
          savingThrowAbilityDefinitionId: WISDOM_ID,
          savingThrowTotal: 10
        }
      })
    ).toMatchObject({ kind: 'PROPOSED', proposal: { resolution: { kind: 'CONTINUE' } } })
    expect(
      resolveDnd5eMorale({
        ...input,
        trigger: {
          kind: 'INDIVIDUAL_SURPRISED',
          scope: 'INDIVIDUAL',
          fact: 'SURPRISED',
          satisfied: true
        },
        individualSavingThrow: {
          actorId: ACTOR_B,
          savingThrowAbilityDefinitionId: WISDOM_ID,
          savingThrowTotal: 9
        }
      })
    ).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        evidence: {
          triggerKind: 'INDIVIDUAL_SURPRISED',
          triggerScope: 'INDIVIDUAL',
          rollerKind: 'SELF',
          rollerActorId: ACTOR_B
        },
        resolution: {
          operations: [
            expect.objectContaining({ primitive: 'SET_MORALE_DISPOSITION', target: 'SUBJECT' })
          ]
        }
      }
    })
    expect(
      resolveDnd5eMorale({
        ...input,
        trigger: {
          kind: 'INDIVIDUAL_SURPRISED',
          scope: 'INDIVIDUAL',
          fact: 'SURPRISED',
          satisfied: true
        },
        individualSavingThrow: {
          actorId: ACTOR_B,
          savingThrowAbilityDefinitionId: WISDOM_ID,
          savingThrowTotal: 9
        },
        leaderOrFallback: null
      })
    ).toMatchObject({ kind: 'PROPOSED', proposal: { evidence: { rollerKind: 'SELF' } } })
    expect(
      resolveDnd5eMorale({
        ...input,
        trigger: {
          kind: 'GROUP_HALF_REMOVED',
          scope: 'GROUP',
          fact: 'HALF_PARTICIPANTS_REMOVED',
          satisfied: true,
          opposingSideHasLosses: true
        } as never
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'MORALE_TRIGGER_NOT_AUTHORIZED' })
    for (const trigger of [
      { kind: 'INDIVIDUAL_SURPRISED', scope: 'INDIVIDUAL', fact: 'SURPRISED' },
      {
        kind: 'INDIVIDUAL_REDUCED_TO_HALF',
        scope: 'INDIVIDUAL',
        fact: 'HALF_HIT_POINTS_REACHED'
      },
      {
        kind: 'INDIVIDUAL_CANNOT_HARM_OPPOSITION',
        scope: 'INDIVIDUAL',
        fact: 'CANNOT_HARM_OPPOSITION'
      },
      { kind: 'GROUP_SURPRISED', scope: 'GROUP', fact: 'GROUP_SURPRISED' },
      {
        kind: 'GROUP_HALF_REMOVED',
        scope: 'GROUP',
        fact: 'HALF_PARTICIPANTS_REMOVED',
        opposingSideHasLosses: false
      },
      { kind: 'GROUP_LEADER_REMOVED', scope: 'GROUP', fact: 'LEADER_REMOVED' },
      { kind: 'GROUP_LEADER_INCAPACITATED', scope: 'GROUP', fact: 'LEADER_INCAPACITATED' },
      { kind: 'GROUP_LEADER_TAKEN_PRISONER', scope: 'GROUP', fact: 'LEADER_TAKEN_PRISONER' }
    ] as const) {
      expect(
        resolveDnd5eMorale({
          ...input,
          trigger: { ...trigger, satisfied: true },
          individualSavingThrow:
            trigger.scope === 'INDIVIDUAL'
              ? { actorId: ACTOR_B, savingThrowAbilityDefinitionId: WISDOM_ID, savingThrowTotal: 9 }
              : null
        })
      ).toMatchObject({
        kind: 'PROPOSED',
        proposal: { evidence: { triggerKind: trigger.kind, triggerScope: trigger.scope } }
      })
    }
    expect(
      resolveDnd5eMorale({
        ...input,
        leaderOrFallback: {
          ...input.leaderOrFallback,
          selection: {
            kind: 'FALLBACK',
            leaderIsEligible: false,
            selectedHasHighestEligibleMorale: false
          } as never
        }
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'MORALE_LEADER_SELECTION_UNVERIFIED' })
    expect(
      resolveDnd5eMorale({
        ...input,
        trigger: {
          kind: 'INDIVIDUAL_SURPRISED',
          scope: 'GROUP',
          fact: 'SURPRISED',
          satisfied: true
        } as never
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'MORALE_TRIGGER_NOT_AUTHORIZED' })
  })
})
