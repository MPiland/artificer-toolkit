import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { withActorTemporaryHitPoints } from '@artificer-toolkit/schema/shared/temporaryHitPoints'
import {
  featureChargeUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  readEncounterActorConditionState,
  targetTemporaryHitPoints
} from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { nextEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { interceptionChargesSpent } from '@artificer-toolkit/rules-runtime/encounterDamageInterception'
import { creatureConditionCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import { rejectDomain } from './domainRejections.js'

/** A settled mechanics batch: an action's on its target, or a won check's outcome (D173). */
export type ActionBatch = Extract<
  ServerRuleExecutionApplicationOutputsDto,
  { kind: 'CHARACTER_MECHANICS_BATCH' | 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
>

/** Refuses an undo the receipt cannot make exactly, telling the GM to adjust by hand. */
export function revertUnavailable(message: string): never {
  return rejectDomain('REVERT_UNAVAILABLE', message)
}

/** Puts a Creature's hit points back as a batch found them, refusing if they changed since. */
export function withHitPointsBefore(
  actor: EncounterRunActorState,
  transition: Pick<ActionBatch['targetTransition'], 'before' | 'after'>
) {
  if (actor.kind === 'CHARACTER') throw new Error('Character hit points are not Run state.')
  if (
    actor.currentHitPoints !== transition.after.currentHitPoints ||
    actor.tempHitPoints !== transition.after.temporaryHitPoints ||
    actor.maxHitPoints !== transition.after.maximumHitPoints
  )
    revertUnavailable(`${actor.label}'s hit points changed after this action; adjust manually.`)
  return encounterRunActorStateSchema.parse(
    withActorTemporaryHitPoints(
      {
        ...actor,
        currentHitPoints: transition.before.currentHitPoints,
        maxHitPoints: transition.before.maximumHitPoints,
        defeated: nextEncounterActorDefeated(actor, transition.before.currentHitPoints)
      },
      targetTemporaryHitPoints(transition.before)
    )
  )
}

/**
 * Inverts one settled mechanics batch on its target, an action's or a won check's (D173): the
 * departure it made (D128), and the hit points, death saves and conditions it changed (D63). A
 * Creature's go back in the Run; a Character's come back as its Sheet inverse, null when the batch
 * left the Sheet as it was. It refuses what the receipt does not record.
 */
export function invertTargetMechanics(
  gameSystemId: string,
  target: EncounterRunActorState,
  mechanics: Pick<ActionBatch, 'applications' | 'targetTransition'> & {
    targetCharacterStreamVersion: number | null
  }
) {
  const { applications, targetTransition } = mechanics
  const addedConditionIds = new Set(
    applications.flatMap((application) =>
      application.kind === 'CONDITION_APPLY' && application.applied ? [application.conditionId] : []
    )
  )
  let actor = target
  // A departure puts the target back unless the table already returned or removed it (D128).
  if (applications.some((application) => application.kind === 'DEPART' && application.applied)) {
    if (target.absence !== 'DEPARTED')
      revertUnavailable(
        `${target.label} was returned to the Scene after this action; adjust manually.`
      )
    actor = encounterRunActorStateSchema.parse({ ...actor, absence: null })
  }
  if (actor.kind !== 'CHARACTER') {
    const restored = withHitPointsBefore(actor, targetTransition)
    if (restored.kind === 'CHARACTER') throw new Error('Character hit points are not Run state.')
    const conditions = readEncounterActorConditionState(restored.conditions ?? [])
    return {
      actor: encounterRunActorStateSchema.parse({
        ...restored,
        conditions: conditions.values.filter(
          (_, index) => !addedConditionIds.has(conditions.ids[index]!)
        )
      }),
      sheet: null
    }
  }
  if (actor.sourceId === null) throw new Error('Stored Character action target is invalid.')
  // A reapplied condition may have moved from Campaign context into the Sheet; that is not recorded.
  if (
    applications.some(
      (application) => application.kind === 'CONDITION_APPLY' && !application.applied
    )
  )
    revertUnavailable("Undo can't restore a reapplied condition; adjust manually.")
  // D63: dropping to 0 added the System's 0 hit point condition, and healing from 0 removed it.
  const { before, after } = targetTransition
  const { zeroHitPointsConditionDefinitionId: zeroHitPointsConditionId } =
    creatureConditionCapabilityRegistry.require(gameSystemId)
  const droppedToZero = before.currentHitPoints > 0 && after.currentHitPoints === 0
  if (
    zeroHitPointsConditionId !== null &&
    before.currentHitPoints === 0 &&
    after.currentHitPoints > 0 &&
    before.conditionIds.includes(zeroHitPointsConditionId)
  )
    revertUnavailable("Undo can't restore a removed condition; adjust manually.")
  const streamVersion = mechanics.targetCharacterStreamVersion
  return {
    actor,
    sheet:
      streamVersion === null
        ? null
        : {
            characterId: actor.sourceId,
            streamVersion,
            hitPoints: before,
            removedConditionIds: new Set([
              ...addedConditionIds,
              ...(zeroHitPointsConditionId !== null &&
              droppedToZero &&
              !before.conditionIds.includes(zeroHitPointsConditionId)
                ? [zeroHitPointsConditionId]
                : [])
            ])
          }
  }
}

/**
 * Gives back, last spend first, the feature charges a Run creature's held damage interceptions
 * spent; a Character's spent its Sheet pools, which `restoreCharacter` gives back.
 */
export function returnInterceptionCharges(
  holder: EncounterRunActorState,
  applications: ActionBatch['applications']
) {
  if (holder.kind === 'CHARACTER') return holder
  return interceptionChargesSpent(applications)
    .toReversed()
    .reduce((actor, charge) => {
      if (featureChargeUsed(actor, charge.ownerFeatureId) !== charge.afterUsed)
        revertUnavailable(
          "The target's feature charges changed after this action; adjust manually."
        )
      return encounterRunActorStateSchema.parse({
        ...actor,
        resources: withFeatureChargeUsed(actor, charge.ownerFeatureId, charge.beforeUsed)
      })
    }, holder)
}
