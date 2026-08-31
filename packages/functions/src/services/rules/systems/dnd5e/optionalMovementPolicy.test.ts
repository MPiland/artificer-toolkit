import { checksumCanonicalJson } from '@artificer-toolkit/db'
import {
  DND5E_OVERRUN_DEFINITION_ID,
  DND5E_OVERRUN_OPERATION_KEY,
  DND5E_SHOVE_ASIDE_DEFINITION_ID,
  DND5E_SHOVE_ASIDE_OPERATION_KEY,
  DND5E_TUMBLE_DEFINITION_ID,
  DND5E_TUMBLE_OPERATION_KEY,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { describe, expect, it } from 'vitest'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import {
  resolveDnd5eOverrun,
  resolveDnd5eShoveAside,
  resolveDnd5eTumble
} from './optionalMovementPolicy.js'

const ACTOR_A = '00000000-0000-4000-8000-0000000000a1'
const ACTOR_B = '00000000-0000-4000-8000-0000000000a2'

const definitions = {
  OVERRUN: { id: DND5E_OVERRUN_DEFINITION_ID, module: DND5E_OVERRUN_OPERATION_KEY },
  SHOVE_ASIDE: { id: DND5E_SHOVE_ASIDE_DEFINITION_ID, module: DND5E_SHOVE_ASIDE_OPERATION_KEY },
  TUMBLE: { id: DND5E_TUMBLE_DEFINITION_ID, module: DND5E_TUMBLE_OPERATION_KEY }
} as const

function snapshot(kind: keyof typeof definitions): EncounterOptionalCombatSnapshotDto {
  const selected = definitions[kind]
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
  kind: keyof typeof definitions,
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

function passageFacts(kind: 'OVERRUN' | 'TUMBLE') {
  return {
    ...base(kind),
    initiatorActorId: ACTOR_A,
    blockerActorId: ACTOR_B,
    actionEconomy: 'BONUS_ACTION' as const,
    actionEconomyAvailable: true,
    passageAlreadyUsedThisTurn: false,
    contest: { initiatorTotal: 16, targetTotal: 12 }
  }
}

describe('D&D optional movement policies', () => {
  it('pins an exact active Overrun definition, uses the selected action economy, and is inert in Manual', () => {
    const input = {
      ...passageFacts('OVERRUN'),
      initiatorSizeRank: 3,
      targetSizeRank: 2,
      qualifiedInitiatorContributors: []
    }
    const automatic = resolveDnd5eOverrun(input)
    const assisted = resolveDnd5eOverrun({ ...input, automationMode: 'ASSISTED' })
    expect(automatic).toEqual(assisted)
    expect(automatic).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        pin: { definitionId: DND5E_OVERRUN_DEFINITION_ID, definitionVersion: 1 },
        consumes: { economy: 'BONUS_ACTION', amount: 1 },
        contest: {
          initiatorCheck: 'ATHLETICS',
          targetCheck: 'ATHLETICS',
          initiatorMode: 'ADVANTAGE'
        },
        passage: {
          currentTurnOnly: true,
          opportunityAttackSuppression: false,
          prohibitEndingInOccupiedSpace: true
        }
      }
    })
    expect(resolveDnd5eOverrun({ ...input, automationMode: 'MANUAL' })).toEqual({ kind: 'INERT' })
    expect(
      resolveDnd5eOverrun({ ...input, optionalCombatSnapshotChecksum: '0'.repeat(64) })
    ).toEqual({ kind: 'INERT' })
  })

  it('uses canonical d20 cancellation for Overrun size advantage', () => {
    const result = resolveDnd5eOverrun({
      ...passageFacts('OVERRUN'),
      initiatorSizeRank: 3,
      targetSizeRank: 2,
      qualifiedInitiatorContributors: [
        {
          id: 'existing-disadvantage',
          influence: 'DISADVANTAGE',
          reason: 'EXISTING_QUALIFIED_FACT'
        }
      ]
    })
    expect(result).toMatchObject({
      kind: 'PROPOSED',
      proposal: { contest: { initiatorMode: 'NORMAL' } }
    })
  })

  it('rejects Overrun ties/failures and a previously spent passage', () => {
    const input = {
      ...passageFacts('OVERRUN'),
      initiatorSizeRank: 2,
      targetSizeRank: 2,
      qualifiedInitiatorContributors: []
    }
    expect(
      resolveDnd5eOverrun({ ...input, contest: { initiatorTotal: 12, targetTotal: 12 } })
    ).toEqual({
      kind: 'NOT_APPLICABLE'
    })
    expect(resolveDnd5eOverrun({ ...input, passageAlreadyUsedThisTurn: true })).toEqual({
      kind: 'NOT_APPLICABLE'
    })
  })

  it('resolves Tumble only on a strict Acrobatics success without opportunity-attack suppression', () => {
    const input = passageFacts('TUMBLE')
    expect(resolveDnd5eTumble(input)).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        contest: { initiatorCheck: 'ACROBATICS', targetCheck: 'ACROBATICS' },
        passage: { opportunityAttackSuppression: false, prohibitEndingInOccupiedSpace: true }
      }
    })
    expect(
      resolveDnd5eTumble({ ...input, contest: { initiatorTotal: 12, targetTotal: 12 } })
    ).toEqual({
      kind: 'NOT_APPLICABLE'
    })
  })

  it('applies Shove Aside disadvantage, accepts either target contest choice, and proposes only 5-foot forced movement', () => {
    const input = {
      ...base('SHOVE_ASIDE'),
      attackerActorId: ACTOR_A,
      targetActorId: ACTOR_B,
      attackerSizeRank: 2,
      targetSizeRank: 3,
      attackReplacementAvailable: true,
      targetInReach: true,
      targetIncapacitated: false,
      targetCheck: 'ACROBATICS' as const,
      contest: { initiatorTotal: 16, targetTotal: 12 },
      qualifiedInitiatorContributors: [],
      destination: { isLegal: true, remainsWithinAttackerReach: true, distanceFeet: 5 }
    }
    expect(resolveDnd5eShoveAside(input)).toMatchObject({
      kind: 'PROPOSED',
      proposal: {
        replacesAttack: true,
        contest: {
          initiatorCheck: 'ATHLETICS',
          targetCheck: 'ACROBATICS',
          initiatorMode: 'DISADVANTAGE'
        },
        displacement: { type: 'FORCED', distanceFeet: 5, opportunityAttackSuppression: false }
      }
    })
    expect(resolveDnd5eShoveAside({ ...input, targetCheck: 'ATHLETICS' })).toMatchObject({
      kind: 'PROPOSED',
      proposal: { contest: { targetCheck: 'ATHLETICS' } }
    })
  })

  it('requires a legal exact Shove Aside destination and normal shove eligibility', () => {
    const input = {
      ...base('SHOVE_ASIDE'),
      attackerActorId: ACTOR_A,
      targetActorId: ACTOR_B,
      attackerSizeRank: 2,
      targetSizeRank: 3,
      attackReplacementAvailable: true,
      targetInReach: true,
      targetIncapacitated: false,
      targetCheck: 'ATHLETICS' as const,
      contest: { initiatorTotal: 16, targetTotal: 12 },
      qualifiedInitiatorContributors: [],
      destination: { isLegal: true, remainsWithinAttackerReach: true, distanceFeet: 5 }
    }
    expect(resolveDnd5eShoveAside({ ...input, destination: null })).toEqual({
      kind: 'JUDGMENT_REQUIRED',
      reason: 'MISSING_SHOVE_ASIDE_FACTS'
    })
    expect(
      resolveDnd5eShoveAside({
        ...input,
        destination: { isLegal: false, remainsWithinAttackerReach: true, distanceFeet: 5 }
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'SHOVE_ASIDE_DESTINATION_UNRESOLVED' })
    expect(resolveDnd5eShoveAside({ ...input, targetSizeRank: 4 })).toEqual({
      kind: 'NOT_APPLICABLE'
    })
  })
})
