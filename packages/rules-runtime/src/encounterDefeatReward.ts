import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'

import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import {
  deriveEncounterCharacterMechanicsEventCommandId,
  type ReceiptApplications
} from './encounterCharacterMechanicsBatch.js'
import type { EncounterMechanicsBatchInput } from './encounterMechanicsBatchPlan.js'
import type { MovementTarget } from './encounterMovementTargets.js'

/**
 * Whether a batch's receipt shows its holder reduced from above 0 hit points to 0 by damage.
 * Damage a mirror passed on is not the damager's doing, so it does not count.
 */
export function reducedToZeroHitPoints(applications: ReceiptApplications): boolean {
  return applications.some(
    (application) =>
      application.kind === 'DAMAGE' &&
      application.mirrored !== true &&
      application.beforeCurrentHitPoints > 0 &&
      application.afterCurrentHitPoints === 0
  )
}

/**
 * The temporary hit points a holder gains for reducing a hostile creature to 0 hit points: the
 * folded `DEFEAT_TEMPORARY_HIT_POINTS` bonus, at least 1. 0 when it holds no such grant.
 */
export function defeatTemporaryHitPoints(
  modifierGroups: readonly { domainKey: string; effective: number }[]
): number {
  const groups = modifierGroups.filter(({ domainKey }) =>
    domainKey.startsWith('DEFEAT_TEMPORARY_HIT_POINTS:BONUS')
  )
  return groups.length === 0
    ? 0
    : Math.max(
        1,
        groups.reduce((sum, { effective }) => sum + effective, 0)
      )
}

/**
 * The mechanics batch that gives a killer its defeat reward: one temporary hit point application
 * chained from the killer's current pool, which keeps the higher amount. Pure; the caller supplies
 * the killer's current target and a fresh Run version.
 */
export function defeatRewardMechanicsBatch(input: {
  state: Pick<EncounterRunState, 'id' | 'version'>
  target: MovementTarget
  amount: number
  /** Which defeat batch of the root this is, so a Character's derived command ids never repeat. */
  ordinal: number
  occurrenceId: string
  rootCommandId: string
  occurredAt: string
}): EncounterMechanicsBatchInput {
  const { target } = input
  const actor = target.actor
  const { current, temporary } = target.state
  const afterTemporaryHitPoints = Math.max(temporary, input.amount)
  const application: CharacterRuleActionApplication = {
    kind: 'TEMPORARY_HIT_POINTS',
    requestedAmount: input.amount,
    resolvedAmount: input.amount,
    appliedAmount: afterTemporaryHitPoints - temporary,
    beforeCurrentHitPoints: current,
    afterCurrentHitPoints: current,
    beforeTemporaryHitPoints: temporary,
    afterTemporaryHitPoints,
    maximumHitPoints: target.effectiveMaximumHitPoints,
    targetActorId: actor.id,
    sourceNodeId: input.rootCommandId,
    sourceOperationKey: 'DEFEAT_TEMPORARY_HIT_POINTS',
    authoredPath: null,
    resolvedPath: null
  }
  return {
    encounterId: input.state.id,
    targetActorId: actor.id,
    expectedEncounterVersion: input.state.version,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.rootCommandId,
    commandId:
      actor.kind === 'CHARACTER'
        ? deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.rootCommandId,
            phase: 'DEFEAT_REWARD',
            ordinal: input.ordinal,
            targetCharacterId: actor.sourceId
          })
        : input.rootCommandId,
    occurredAt: input.occurredAt,
    applications: [application],
    expectedCharacterStreamVersion: target.characterFacts?.active.play.streamVersion ?? null,
    effectiveMaximumHitPoints: target.effectiveMaximumHitPoints,
    damageInterceptions: target.damageInterceptions,
    sheetMaximumHitPoints: target.sheetMaximumHitPoints,
    effectiveScalarValues: target.effectiveScalarValues,
    retainedConditionIds: [],
    forceVersionAdvance: actor.kind === 'CHARACTER'
  }
}
