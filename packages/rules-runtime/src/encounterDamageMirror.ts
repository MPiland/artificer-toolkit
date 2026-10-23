import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  damageDispositionOf,
  resolveDispositionDamage
} from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'

import { listActiveEffectGrants } from './character/activeEffectGrantTotals.js'
import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import {
  deriveEncounterCharacterMechanicsEventCommandId,
  type ReceiptApplications
} from './encounterCharacterMechanicsBatch.js'
import type { EncounterMechanicsBatchInput } from './encounterMechanicsBatchPlan.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'

/**
 * A held `DAMAGE_MIRROR` grant (Warding Bond): the damage its holder takes is also taken by the actor
 * that cast the effect, whose own defenses then apply as for any damage.
 */
export type HeldDamageMirror = { effectId: string; sourceActorId: string }

/** Damage a holder took that a held mirror passes on to its source. */
export type PendingDamageMirror = HeldDamageMirror & {
  damageTypeId: string
  /** What the holder took after its own defenses (`resolvedAmount`), not what its hit points absorbed. */
  amount: number
}

/** The holder's mirrors, lowest effect id first so every replay mirrors in the same order. */
export function heldDamageMirrors(effects: readonly ActiveRuleEffectRecord[]): HeldDamageMirror[] {
  return [...effects]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((effect) => {
      const { origin } = effect.definition
      if (origin.kind !== 'ENCOUNTER' || origin.sourceActorId === null) return []
      const { sourceActorId } = origin
      return listActiveEffectGrants([effect]).some(({ modifiers }) =>
        modifiers.some((modifier) => modifier.valueDomainCode === 'DAMAGE_MIRROR')
      )
        ? [{ effectId: effect.id, sourceActorId }]
        : []
    })
}

/**
 * The damage a batch's receipt shows its holder took that the holder's mirrors pass on. Damage that
 * was itself mirrored is never passed on again, and a mirror whose source is the holder mirrors
 * nothing.
 */
export function pendingDamageMirrors(input: {
  holderActorId: string
  mirrors: readonly HeldDamageMirror[]
  applications: ReceiptApplications
}): PendingDamageMirror[] {
  const damage = input.applications.filter(
    (application): application is Extract<ReceiptApplications[number], { kind: 'DAMAGE' }> =>
      application.kind === 'DAMAGE'
  )
  return input.mirrors
    .filter(({ sourceActorId }) => sourceActorId !== input.holderActorId)
    .flatMap((mirror) =>
      damage
        .filter(({ mirrored, resolvedAmount }) => mirrored !== true && resolvedAmount > 0)
        .map(({ damageTypeId, resolvedAmount }) => ({
          ...mirror,
          damageTypeId,
          amount: resolvedAmount
        }))
    )
}

/**
 * The mechanics batch that applies pending mirrors to their source: one `mirrored` damage application
 * per entry, chained through the source's hit points and resolved against the source's own defenses.
 * Pure; the caller supplies the source's current target and a fresh Run version.
 */
export function damageMirrorMechanicsBatch(input: {
  state: Pick<EncounterRunState, 'id' | 'version'>
  target: MovementTarget
  mirrors: readonly PendingDamageMirror[]
  /** Which mirror batch of the root this is, so a Character's derived command ids never repeat. */
  ordinal: number
  occurrenceId: string
  rootCommandId: string
  occurredAt: string
}): EncounterMechanicsBatchInput {
  const { target } = input
  const actor = target.actor
  let current = target.state.current
  let temporary = target.state.temporary
  const applications = input.mirrors.map((mirror): CharacterRuleActionApplication => {
    const damageDisposition = damageDispositionOf(target.defenses, mirror.damageTypeId)
    const resolvedAmount = resolveDispositionDamage(damageDisposition, mirror.amount)
    const temporaryLost = Math.min(temporary, resolvedAmount)
    const currentLost = Math.min(current, resolvedAmount - temporaryLost)
    const application: CharacterRuleActionApplication = {
      kind: 'DAMAGE',
      requestedAmount: mirror.amount,
      resolvedAmount,
      appliedAmount: temporaryLost + currentLost,
      beforeCurrentHitPoints: current,
      afterCurrentHitPoints: current - currentLost,
      beforeTemporaryHitPoints: temporary,
      afterTemporaryHitPoints: temporary - temporaryLost,
      maximumHitPoints: target.effectiveMaximumHitPoints,
      targetActorId: actor.id,
      damageTypeId: mirror.damageTypeId,
      damageDisposition,
      critical: false,
      mirrored: true,
      sourceNodeId: mirror.effectId,
      sourceOperationKey: 'DAMAGE_MIRROR',
      authoredPath: null,
      resolvedPath: null
    }
    current -= currentLost
    temporary -= temporaryLost
    return application
  })
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
            phase: 'DAMAGE_MIRROR',
            ordinal: input.ordinal,
            targetCharacterId: actor.sourceId
          })
        : input.rootCommandId,
    occurredAt: input.occurredAt,
    applications,
    expectedCharacterStreamVersion: target.characterFacts?.active.play.streamVersion ?? null,
    effectiveMaximumHitPoints: target.effectiveMaximumHitPoints,
    damageInterceptions: target.damageInterceptions,
    sheetMaximumHitPoints: target.sheetMaximumHitPoints,
    effectiveScalarValues: target.effectiveScalarValues,
    retainedConditionIds: [],
    forceVersionAdvance: actor.kind === 'CHARACTER'
  }
}
