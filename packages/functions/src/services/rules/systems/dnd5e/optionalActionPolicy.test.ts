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
  resolveDnd5eClimbOntoLargerCreature,
  resolveDnd5eClimbDislodge,
  resolveDnd5eDisarm,
  resolveDnd5eMark,
  resolveDnd5eMarkedOpportunityAttack
} from './optionalActionPolicy.js'

const ACTOR_A = '00000000-0000-4000-8000-0000000000a1'
const ACTOR_B = '00000000-0000-4000-8000-0000000000a2'
const ITEM = '00000000-0000-4000-8000-0000000000a3'

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
  const document = {
    schemaVersion: 1 as const,
    kind,
    id: selected.id,
    gameSystemId: DND5E_SYSTEM_ID,
    module: { policyModuleKey: selected.module, contractVersion: 1 },
    parameters: { kind },
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
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot)
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
      attackerSizeRank: 4,
      targetSizeRank: 2,
      heldItemId: ITEM,
      targetItemOwnerState: 'CHARACTER_SHEET' as const,
      targetCheck: 'ATHLETICS' as const,
      targetHoldsItemWithTwoOrMoreHands: true,
      qualifyingWeaponAttack: true,
      contest: { initiatorTotal: 16, targetTotal: 10 }
    }
    const resolution = resolveDnd5eDisarm(input)
    expect(resolution).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        pin: { definitionId: DND5E_DISARM_DEFINITION_ID },
        contest: {
          initiatorMode: 'NORMAL',
          targetMode: 'NORMAL',
          initiatorContributors: [
            { influence: 'DISADVANTAGE', reason: 'TARGET_HELD_WITH_TWO_OR_MORE_HANDS' },
            { influence: 'ADVANTAGE', reason: 'SIZE_RELATION' }
          ]
        },
        disposition: { transition: 'NO_LONGER_HELD', ownerState: 'CHARACTER_SHEET' }
      }
    })
    expect(resolveDnd5eDisarm({ ...input, automationMode: 'ASSISTED' })).toEqual(resolution)
  })

  it('preserves held state on disarm tie/failure and requires exact held facts', () => {
    const input = {
      ...base('DISARM'),
      attackerActorId: ACTOR_A,
      targetActorId: ACTOR_B,
      attackerSizeRank: 2,
      targetSizeRank: 3,
      heldItemId: ITEM,
      targetItemOwnerState: 'ENCOUNTER_ACTOR' as const,
      targetCheck: 'ACROBATICS' as const,
      targetHoldsItemWithTwoOrMoreHands: false,
      qualifyingWeaponAttack: true,
      contest: { initiatorTotal: 11, targetTotal: 11 }
    }
    expect(resolveDnd5eDisarm(input)).toEqual({ kind: 'NOT_APPLICABLE' })
    expect(resolveDnd5eDisarm({ ...input, heldItemId: null })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'MISSING_DISARM_FACTS'
    })
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
