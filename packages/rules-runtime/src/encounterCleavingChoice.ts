import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import {
  serverAggregateChoicePendingSnapshotDtoSchema,
  type ServerAggregateChoicePendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  resolveDnd5eCleaving,
  type Dnd5eOptionalResolutionPin
} from './systems/dnd5e/optionalResolutionPolicy.js'
import { cleavingChildOccurrenceIdentity } from './encounterCleavingIdentity.js'

export type NativeCleavingCandidate = {
  actorId: string
  targetTokenId: string
  targetActorVersion: number
  targetStateChecksum: string
  armorClass: number
  footprintChecksum: string
  withinAttackerReach: boolean
  originalAttackCanHit: boolean
}

/** Builds the sealed child from already-finalized action facts only. */
export function createNativeCleavingChoice(input: {
  automationMode: AutomationModeDto
  gameSystemId: string
  optionalCombatSnapshot: unknown
  /** The Run's pinned optional-combat policy; a Run without one cannot seal a Cleaving choice. */
  optionalCombatSnapshotChecksum: string | null
  parentOccurrenceId: string
  parentResultChecksum: string
  sourceActorId: string
  sourceControllerCharacterId: string | null
  sourceCurrentness: Extract<
    ServerAggregateChoicePendingSnapshotDto['applicationContext'],
    { kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' }
  >['sourceCurrentness']
  action: Extract<
    ServerAggregateChoicePendingSnapshotDto['applicationContext'],
    { kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' }
  >['action']
  scene: Extract<
    ServerAggregateChoicePendingSnapshotDto['applicationContext'],
    { kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' }
  >['scene']
  initialTargetActorId: string
  chainStep: number
  visitedTargetActorIds: readonly string[]
  originalAttack: { total: number; naturalRoll: number }
  damage: Extract<
    ServerAggregateChoicePendingSnapshotDto['applicationContext'],
    { kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' }
  >['damage']
  candidates: readonly NativeCleavingCandidate[]
}): ServerAggregateChoicePendingSnapshotDto | null {
  const optionalCombatSnapshotChecksum = input.optionalCombatSnapshotChecksum
  if (optionalCombatSnapshotChecksum === null)
    throw new Error("A Cleaving choice requires the Run's pinned optional-combat policy.")
  const eligibleTargetActorIds = input.candidates.map((candidate) => candidate.actorId)
  const proposed = input.candidates.flatMap((candidate) => {
    const resolution = resolveDnd5eCleaving({
      automationMode: input.automationMode,
      gameSystemId: input.gameSystemId,
      optionalCombatSnapshot: input.optionalCombatSnapshot,
      optionalCombatSnapshotChecksum,
      attackKind: input.action.attackKind === 'MELEE' ? 'MELEE' : 'OTHER',
      attackTotal: input.originalAttack.total,
      attackerActorId: input.sourceActorId,
      chainStep: input.chainStep,
      eligibleTargetActorIds,
      initialTargetActorId: input.initialTargetActorId,
      initialTargetReducedToZero: true,
      initialTargetWasUndamaged: true,
      mixedDamageOrRiderAmbiguity: false,
      nextTarget: {
        actorId: candidate.actorId,
        armorClass: candidate.armorClass,
        withinAttackerReach: candidate.withinAttackerReach,
        originalAttackResolution: {
          naturalRoll: input.originalAttack.naturalRoll,
          originalAttackCanHitNextTarget: candidate.originalAttackCanHit
        }
      },
      remainingFinalDamage: input.damage.remainingAmount,
      visitedTargetActorIds: input.visitedTargetActorIds
    })
    return resolution.kind === 'PROPOSED' ? [{ candidate, pin: resolution.proposal.pin }] : []
  })
  if (!proposed.length) return null
  const pin = proposed[0]!.pin
  if (proposed.some((entry) => checksumRuleDocument(entry.pin) !== checksumRuleDocument(pin)))
    throw new Error('Cleaving optional-combat policy is inconsistent.')
  const options = proposed
    .map(({ candidate }) => ({
      targetActorId: candidate.actorId,
      targetTokenId: candidate.targetTokenId,
      targetActorVersion: candidate.targetActorVersion,
      targetStateChecksum: candidate.targetStateChecksum,
      armorClass: candidate.armorClass,
      footprintChecksum: candidate.footprintChecksum,
      optionId: optionId(candidate, pin)
    }))
    .sort((left, right) => left.optionId.localeCompare(right.optionId))
  const occurrenceId = cleavingChildOccurrenceIdentity(
    input.parentOccurrenceId,
    input.chainStep + 1
  )
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    snapshotKind: 'AGGREGATE_CHOICE',
    schemaVersion: 1,
    occurrenceId,
    optionalCombatSnapshotChecksum,
    applicationContext: {
      kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING',
      schemaVersion: 1,
      parentOccurrenceId: input.parentOccurrenceId,
      parentResultChecksum: input.parentResultChecksum,
      sourceActorId: input.sourceActorId,
      sourceControllerCharacterId: input.sourceControllerCharacterId,
      action: input.action,
      sourceCurrentness: input.sourceCurrentness,
      initialTargetActorId: input.initialTargetActorId,
      chainStep: input.chainStep + 1,
      optionalCombat: {
        definitionId: pin.definitionId,
        definitionVersion: pin.definitionVersion,
        definitionChecksum: pin.definitionChecksum
      },
      scene: input.scene,
      originalAttack: input.originalAttack,
      damage: input.damage,
      visitedTargetActorIds: input.visitedTargetActorIds,
      options
    }
  })
}

function optionId(candidate: NativeCleavingCandidate, pin: Dnd5eOptionalResolutionPin) {
  return checksumRuleDocument({
    targetActorId: candidate.actorId,
    targetTokenId: candidate.targetTokenId,
    targetActorVersion: candidate.targetActorVersion,
    targetStateChecksum: candidate.targetStateChecksum,
    armorClass: candidate.armorClass,
    footprintChecksum: candidate.footprintChecksum,
    pin
  })
}
