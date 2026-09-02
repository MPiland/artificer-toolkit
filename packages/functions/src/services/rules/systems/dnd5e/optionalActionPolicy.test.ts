import { checksumCanonicalJson } from '@artificer-toolkit/db'
import {
  DND5E_CLIMB_ONTO_LARGER_CREATURE_DEFINITION_ID,
  DND5E_CLIMB_ONTO_LARGER_CREATURE_OPERATION_KEY,
  DND5E_DISARM_DEFINITION_ID,
  DND5E_DISARM_OPERATION_KEY,
  DND5E_MARK_DEFINITION_ID,
  DND5E_MARK_OPERATION_KEY,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { describe, expect, it } from 'vitest'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import {
  prepareDnd5eDisarmContest,
  resolveDnd5eClimbOntoLargerCreature,
  resolveDnd5eClimbDislodge,
  resolveDnd5eDisarm,
  resolveDnd5eMark,
  resolveDnd5eMarkedOpportunityAttack
} from './optionalActionPolicy.js'

const ACTOR_A = '00000000-0000-4000-8000-0000000000a1'
const ACTOR_B = '00000000-0000-4000-8000-0000000000a2'
const ITEM = '00000000-0000-4000-8000-0000000000a3'
const ACROBATICS_DEFINITION_ID = '00000000-0000-4000-8000-0000000000a4'
const ATHLETICS_DEFINITION_ID = '00000000-0000-4000-8000-0000000000a5'

const documents = {
  CLIMB_ONTO_LARGER_CREATURE: {
    id: DND5E_CLIMB_ONTO_LARGER_CREATURE_DEFINITION_ID,
    module: DND5E_CLIMB_ONTO_LARGER_CREATURE_OPERATION_KEY
  },
  DISARM: { id: DND5E_DISARM_DEFINITION_ID, module: DND5E_DISARM_OPERATION_KEY },
  MARK: { id: DND5E_MARK_DEFINITION_ID, module: DND5E_MARK_OPERATION_KEY }
} as const

function snapshot(kind: keyof typeof documents): EncounterOptionalCombatSnapshotDto {
  const selected = documents[kind]
  const parameters =
    kind === 'DISARM'
      ? {
          kind,
          defenderCheckDefinitionIds: [ATHLETICS_DEFINITION_ID, ACROBATICS_DEFINITION_ID]
        }
      : { kind }
  const document = {
    schemaVersion: 1 as const,
    kind,
    id: selected.id,
    gameSystemId: DND5E_SYSTEM_ID,
    module: { policyModuleKey: selected.module, contractVersion: 1 },
    parameters,
    mutuallyExclusiveGroup: null
  }
  return {
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
  }
}

function base(
  kind: keyof typeof documents,
  automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL' = 'AUTOMATIC'
) {
  const optionalCombatSnapshot = snapshot(kind)
  return {
    automationMode,
    gameSystemId: DND5E_SYSTEM_ID,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    attack: {
      modifier: 5,
      rollMode: 'NORMAL' as const,
      baseContributors: { MELEE: [], RANGED: [], SPELL: [], UNARMED: [] },
      relationshipContributors: []
    }
  } as const
}

describe('D&D optional action policies', () => {
  it('pins climb current definition and makes Manual inert while Automatic and Assisted agree', () => {
    const input = {
      ...base('CLIMB_ONTO_LARGER_CREATURE'),
      climberActorId: ACTOR_A,
      targetActorId: ACTOR_B,
      climberCheck: 'ATHLETICS' as const,
      targetCheck: 'ACROBATICS' as const,
      climberSizeRank: 2,
      targetSizeRank: 3,
      suitability: 'SUITABLE' as const,
      contest: { initiatorTotal: 18, targetTotal: 12 }
    }
    const automatic = resolveDnd5eClimbOntoLargerCreature(input)
    const assisted = resolveDnd5eClimbOntoLargerCreature({ ...input, automationMode: 'ASSISTED' })
    expect(automatic).toEqual(assisted)
    expect(automatic).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        pin: { definitionId: DND5E_CLIMB_ONTO_LARGER_CREATURE_DEFINITION_ID },
        attachment: { inheritsTargetMovement: true, movementWithinTargetFootprint: 'DIFFICULT' }
      }
    })
    expect(resolveDnd5eClimbOntoLargerCreature({ ...input, automationMode: 'MANUAL' })).toEqual({
      kind: 'INERT'
    })
    expect(
      resolveDnd5eClimbOntoLargerCreature({
        ...input,
        optionalCombatSnapshotChecksum: 'a'.repeat(64)
      })
    ).toEqual({ kind: 'INERT' })
  })

  it('handles climb tie/failure and missing suitability without a proposal', () => {
    const input = {
      ...base('CLIMB_ONTO_LARGER_CREATURE'),
      climberActorId: ACTOR_A,
      targetActorId: ACTOR_B,
      climberCheck: 'ACROBATICS' as const,
      targetCheck: 'ACROBATICS' as const,
      climberSizeRank: 2,
      targetSizeRank: 3,
      suitability: 'SUITABLE' as const,
      contest: { initiatorTotal: 12, targetTotal: 12 }
    }
    expect(resolveDnd5eClimbOntoLargerCreature(input)).toEqual({ kind: 'NOT_APPLICABLE' })
    expect(
      resolveDnd5eClimbOntoLargerCreature({ ...input, suitability: 'JUDGMENT_REQUIRED' })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'CLIMB_SUITABILITY_UNRESOLVED' })
  })

  it('treats a successful dislodge as a separate attachment removal with adjudicated landing', () => {
    expect(
      resolveDnd5eClimbDislodge({
        ...base('CLIMB_ONTO_LARGER_CREATURE'),
        climberActorId: ACTOR_A,
        targetActorId: ACTOR_B,
        climberCheck: 'ACROBATICS',
        targetCheck: 'ATHLETICS',
        contest: { initiatorTotal: 15, targetTotal: 10 }
      })
    ).toMatchObject({
      kind: 'PROPOSED',
      proposal: { attachment: { transition: 'REMOVE' }, landing: 'JUDGMENT_REQUIRED' }
    })
  })

  it('proposes a disarm disposition with the exact contest modifiers', () => {
    const input = {
      ...base('DISARM'),
      attackerActorId: ACTOR_A,
      targetActorId: ACTOR_B,
      attackerSize: 'HUGE',
      targetSize: 'MEDIUM',
      heldItemId: ITEM,
      targetItemOwnerState: 'CHARACTER_SHEET' as const,
      targetCheckDefinitionId: ATHLETICS_DEFINITION_ID,
      targetEquipment: { properties: ['TWO_HANDED'] },
      triggerCode: 'MELEE_WEAPON_ATTACK',
      sourceEquipment: { id: ITEM, category: 'WEAPON', properties: [], state: 'EQUIPPED' as const },
      contest: { initiatorTotal: 16, targetTotal: 10 }
    }
    const resolution = resolveDnd5eDisarm(input)
    expect(resolution).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        pin: { definitionId: DND5E_DISARM_DEFINITION_ID },
        contest: {
          targetCheckDefinitionId: ATHLETICS_DEFINITION_ID,
          initiatorMode: 'DISADVANTAGE',
          targetMode: 'DISADVANTAGE',
          initiatorContributors: [
            { influence: 'DISADVANTAGE', reason: 'TARGET_HELD_WITH_TWO_OR_MORE_HANDS' }
          ],
          targetContributors: [{ influence: 'DISADVANTAGE', reason: 'SIZE_RELATION' }]
        },
        disposition: { transition: 'NO_LONGER_HELD', ownerState: 'CHARACTER_SHEET' }
      }
    })
    expect(resolveDnd5eDisarm({ ...input, automationMode: 'ASSISTED' })).toEqual(resolution)
    if (resolution.kind !== 'PROPOSED') throw new Error('Expected a Disarm proposal.')
    const repeated = resolveDnd5eDisarm(input)
    if (repeated.kind !== 'PROPOSED') throw new Error('Expected a repeated Disarm proposal.')
    expect(repeated.proposal.contest.initiatorContributors).toEqual(
      resolution.proposal.contest.initiatorContributors
    )
    expect(resolution.proposal.contest.initiatorContributors[0]).toMatchObject({
      grantId: null,
      domainKey: 'TARGET_HELD_WITH_TWO_OR_MORE_HANDS'
    })
    const revisedSnapshot = snapshot('DISARM')
    revisedSnapshot.definitions[0] = {
      ...revisedSnapshot.definitions[0]!,
      definitionVersion: 2
    }
    const revised = resolveDnd5eDisarm({
      ...input,
      optionalCombatSnapshot: revisedSnapshot,
      optionalCombatSnapshotChecksum: checksumCanonicalJson(revisedSnapshot)
    })
    if (revised.kind !== 'PROPOSED') throw new Error('Expected a revised Disarm proposal.')
    expect(revised.proposal.contest.initiatorContributors[0]?.sourceId).not.toBe(
      resolution.proposal.contest.initiatorContributors[0]?.sourceId
    )
  })

  it('prepares disarm policy before contest totals exist', () => {
    expect(
      prepareDnd5eDisarmContest({
        ...base('DISARM'),
        attackerActorId: ACTOR_A,
        targetActorId: ACTOR_B,
        attackerSize: 'MEDIUM',
        targetSize: 'HUGE',
        heldItemId: ITEM,
        targetItemOwnerState: 'ENCOUNTER_ACTOR',
        targetCheckDefinitionId: ACROBATICS_DEFINITION_ID,
        targetEquipment: { properties: ['TWO_HANDED'] },
        triggerCode: 'RANGED_WEAPON_ATTACK',
        sourceEquipment: { id: ITEM, category: 'WEAPON', properties: [], state: 'EQUIPPED' }
      })
    ).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        contest: {
          initiatorMode: 'DISADVANTAGE',
          targetMode: 'ADVANTAGE',
          targetCheckDefinitionId: ACROBATICS_DEFINITION_ID
        }
      }
    })
  })

  it('applies handedness only to the attack and size only to the target check', () => {
    const input = {
      ...base('DISARM'),
      attackerActorId: ACTOR_A,
      targetActorId: ACTOR_B,
      attackerSize: 'MEDIUM',
      targetSize: 'MEDIUM',
      heldItemId: ITEM,
      targetItemOwnerState: 'ENCOUNTER_ACTOR' as const,
      targetCheckDefinitionId: ACROBATICS_DEFINITION_ID,
      targetEquipment: { properties: [] },
      triggerCode: 'MELEE_WEAPON_ATTACK',
      sourceEquipment: { id: ITEM, category: 'WEAPON', properties: [], state: 'HELD' as const },
      contest: { initiatorTotal: 16, targetTotal: 10 }
    }
    expect(resolveDnd5eDisarm(input)).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        contest: {
          initiatorMode: 'NORMAL',
          targetMode: 'NORMAL',
          initiatorContributors: [],
          targetContributors: []
        }
      }
    })
    expect(resolveDnd5eDisarm({ ...input, targetSize: 'HUGE' })).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        contest: {
          initiatorMode: 'NORMAL',
          targetMode: 'ADVANTAGE',
          targetContributors: [{ influence: 'ADVANTAGE', reason: 'SIZE_RELATION' }]
        }
      }
    })
    expect(
      resolveDnd5eDisarm({ ...input, targetEquipment: { properties: ['TWO_HANDED'] } })
    ).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        contest: {
          initiatorMode: 'DISADVANTAGE',
          targetMode: 'NORMAL',
          initiatorContributors: [
            { influence: 'DISADVANTAGE', reason: 'TARGET_HELD_WITH_TWO_OR_MORE_HANDS' }
          ]
        }
      }
    })
  })

  it('combines exact base and relationship attack contributors before disarm handedness', () => {
    const input = {
      ...base('DISARM'),
      attackerActorId: ACTOR_A,
      targetActorId: ACTOR_B,
      attackerSize: 'MEDIUM',
      targetSize: 'MEDIUM',
      heldItemId: ITEM,
      targetItemOwnerState: 'ENCOUNTER_ACTOR' as const,
      targetCheckDefinitionId: ACROBATICS_DEFINITION_ID,
      targetEquipment: { properties: ['TWO_HANDED'] },
      triggerCode: 'MELEE_WEAPON_ATTACK',
      sourceEquipment: { id: ITEM, category: 'WEAPON', properties: [], state: 'HELD' as const },
      contest: { initiatorTotal: 16, targetTotal: 10 },
      attack: {
        modifier: 5,
        rollMode: 'ADVANTAGE' as const,
        baseContributors: {
          MELEE: [
            {
              sourceId: 'base-advantage',
              grantId: 'grant-a',
              domainKey: 'base',
              influence: 'ADVANTAGE' as const
            }
          ],
          RANGED: [],
          SPELL: [],
          UNARMED: []
        },
        relationshipContributors: []
      }
    }
    expect(resolveDnd5eDisarm(input)).toMatchObject({
      kind: 'PROPOSED',
      proposal: { contest: { initiatorMode: 'NORMAL' } }
    })
    expect(
      resolveDnd5eDisarm({ ...input, attack: { ...input.attack, rollMode: 'NORMAL' } })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'DISARM_ATTACK_POLICY_UNRESOLVED' })
  })

  it('preserves held state on disarm tie/failure and requires exact held facts', () => {
    const input = {
      ...base('DISARM'),
      attackerActorId: ACTOR_A,
      targetActorId: ACTOR_B,
      attackerSize: 'MEDIUM',
      targetSize: 'LARGE',
      heldItemId: ITEM,
      targetItemOwnerState: 'ENCOUNTER_ACTOR' as const,
      targetCheckDefinitionId: ACROBATICS_DEFINITION_ID,
      targetEquipment: { properties: [] },
      triggerCode: 'MELEE_WEAPON_ATTACK',
      sourceEquipment: { id: ITEM, category: 'WEAPON', properties: [], state: 'HELD' as const },
      contest: { initiatorTotal: 11, targetTotal: 11 }
    }
    expect(resolveDnd5eDisarm(input)).toEqual({ kind: 'NOT_APPLICABLE' })
    expect(resolveDnd5eDisarm({ ...input, heldItemId: null })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'MISSING_DISARM_FACTS'
    })
    expect(resolveDnd5eDisarm({ ...input, triggerCode: 'MELEE_SPELL_ATTACK' })).toEqual({
      kind: 'NOT_APPLICABLE'
    })
    expect(
      resolveDnd5eDisarm({ ...input, targetEquipment: { properties: ['VERSATILE'] } })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'DISARM_GRIP_UNRESOLVED' })
    expect(
      resolveDnd5eDisarm({
        ...input,
        targetCheckDefinitionId: '00000000-0000-4000-8000-0000000000ff'
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_DISARM_FACTS' })
  })

  it('marks both melee hits and misses, with a bounded independent marked OA use', () => {
    const mark = resolveDnd5eMark({
      ...base('MARK'),
      markerActorId: ACTOR_A,
      targetActorId: ACTOR_B,
      qualifyingMeleeAttackResolved: true
    })
    expect(mark).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        expiresAt: 'END_OF_MARKER_NEXT_TURN',
        reaction: { doesNotConsumeNormalReactionAllowance: true, maximumUsesPerTurn: 1 }
      }
    })
    const proposal = mark.kind === 'PROPOSED' ? mark.proposal : null
    expect(
      resolveDnd5eMarkedOpportunityAttack({
        ...base('MARK'),
        markEffect: proposal,
        existingOpportunityAttackEligible: true,
        reactionsEnabled: true,
        markedOpportunityAttackUsesThisTurn: 0
      })
    ).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        contributor: { influence: 'ADVANTAGE' },
        consumesMarkedOpportunityAttackUse: true
      }
    })
    expect(
      resolveDnd5eMarkedOpportunityAttack({
        ...base('MARK'),
        markEffect: proposal,
        existingOpportunityAttackEligible: true,
        reactionsEnabled: true,
        markedOpportunityAttackUsesThisTurn: 1
      })
    ).toEqual({ kind: 'NOT_APPLICABLE' })
  })

  it('does not create a Mark trigger or bypass missing reaction facts', () => {
    const input = {
      ...base('MARK'),
      markerActorId: ACTOR_A,
      targetActorId: ACTOR_B,
      qualifyingMeleeAttackResolved: true
    }
    const mark = resolveDnd5eMark(input)
    const proposal = mark.kind === 'PROPOSED' ? mark.proposal : null
    expect(
      resolveDnd5eMarkedOpportunityAttack({
        ...base('MARK'),
        markEffect: proposal,
        existingOpportunityAttackEligible: false,
        reactionsEnabled: true,
        markedOpportunityAttackUsesThisTurn: 0
      })
    ).toEqual({ kind: 'NOT_APPLICABLE' })
    expect(
      resolveDnd5eMarkedOpportunityAttack({
        ...base('MARK'),
        markEffect: proposal,
        existingOpportunityAttackEligible: true,
        reactionsEnabled: null,
        markedOpportunityAttackUsesThisTurn: 0
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_MARK_REACTION_FACTS' })
    expect(resolveDnd5eMark({ ...input, qualifyingMeleeAttackResolved: null })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'MISSING_MARK_FACTS'
    })
  })
})
