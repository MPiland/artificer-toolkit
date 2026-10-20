import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { damageInterceptionPayloadDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import { resolveDispositionDamage } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'

import { listActiveEffectGrants } from './character/activeEffectGrantTotals.js'
import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import { EncounterValidationError } from './encounterErrors.js'

/**
 * A held `DAMAGE_INTERCEPTION` grant (Death Ward; Undead Fortitude and Relentless Endurance reuse
 * it): damage that would drop the holder to 0 hit points leaves it at `dropToHitPoints`, and an
 * instant-death effect is negated when `negatesKill`. Each interception spends one of the holding
 * effect's `uses`; the last use ends the effect (persistence, like attack decoys).
 */
export type HeldDamageInterception = {
  effectId: string
  dropToHitPoints: number
  negatesKill: boolean
}

/**
 * The holder's interceptions in the order they are spent: lowest effect id first, so every replay
 * picks the same one. An effect with no use left holds none.
 */
export function heldDamageInterceptions(
  effects: readonly ActiveRuleEffectRecord[]
): HeldDamageInterception[] {
  return [...effects]
    .sort((left, right) => left.id.localeCompare(right.id))
    .filter((effect) => (effect.lifecycle.remainingUses ?? 0) >= 1)
    .flatMap((effect) =>
      listActiveEffectGrants([effect]).flatMap(({ modifiers }) =>
        modifiers
          .filter((modifier) => modifier.valueDomainCode === 'DAMAGE_INTERCEPTION')
          .map((modifier) => {
            const payload = damageInterceptionPayloadDtoSchema.parse(modifier.payload)
            return {
              effectId: effect.id,
              dropToHitPoints: payload.dropToHitPoints,
              negatesKill: payload.negatesKill
            }
          })
      )
    )
}

/**
 * The hit points damage leaves the holder at: the interception's when the damage would drop it from
 * above 0 to 0, otherwise the plain result. `currentLost` is what the damage takes off current hit
 * points after temporary hit points.
 */
export function hitPointsAfterDamage(input: {
  current: number
  currentLost: number
  maximum: number
  interception: HeldDamageInterception | undefined
}) {
  const { current, currentLost, interception } = input
  return interception !== undefined && current > 0 && current - currentLost === 0
    ? Math.min(interception.dropToHitPoints, input.maximum)
    : current - currentLost
}

/**
 * Applies a batch's interceptions in order, the first lethal damage or kill spending each one: the
 * damage ends at the interception's hit points and names it (`interceptedBy`), a kill is replaced by
 * a `KILL_NEGATED` the same ward negates. Damage later in the batch is rebased onto the hit points
 * the interception left, so a second blow meets the ward already spent. Pure, and shared by every
 * actor kind: a Character and a Run creature settle damage through the same planner and fold.
 */
export function applyDamageInterceptions(input: {
  applications: readonly CharacterRuleActionApplication[]
  currentHitPoints: number
  temporaryHitPoints: number
  maximumHitPoints: number
  interceptions: readonly HeldDamageInterception[]
}): CharacterRuleActionApplication[] {
  if (input.interceptions.length === 0) return [...input.applications]
  const unspent = [...input.interceptions]
  let current = input.currentHitPoints
  let temporary = input.temporaryHitPoints
  let rebased = false
  return input.applications.map((application) => {
    if (application.kind === 'KILL') {
      const index = unspent.findIndex((interception) => interception.negatesKill)
      if (index < 0) {
        current = 0
        temporary = 0
        return application
      }
      const [spent] = unspent.splice(index, 1)
      const { kind: _kind, ...trace } = application
      return { ...trace, kind: 'KILL_NEGATED', negatedBy: spent!.effectId }
    }
    if (application.kind === 'HEAL' && rebased) {
      const appliedAmount = Math.min(application.resolvedAmount, input.maximumHitPoints - current)
      current += appliedAmount
      return {
        ...application,
        appliedAmount,
        beforeCurrentHitPoints: current - appliedAmount,
        afterCurrentHitPoints: current,
        beforeTemporaryHitPoints: temporary,
        afterTemporaryHitPoints: temporary
      }
    }
    if (application.kind !== 'DAMAGE') {
      if (rebased && 'afterCurrentHitPoints' in application)
        throw new EncounterValidationError(
          'A damage interception cannot precede other hit point changes in one batch.'
        )
      current = 'afterCurrentHitPoints' in application ? application.afterCurrentHitPoints : current
      temporary =
        'afterTemporaryHitPoints' in application ? application.afterTemporaryHitPoints : temporary
      return application
    }
    const resolvedAmount = resolveDispositionDamage(
      application.damageDisposition,
      application.requestedAmount
    )
    const temporaryLost = Math.min(temporary, resolvedAmount)
    const currentLost = Math.min(current, resolvedAmount - temporaryLost)
    const interception = unspent[0]
    const after = hitPointsAfterDamage({
      current,
      currentLost,
      maximum: input.maximumHitPoints,
      interception
    })
    const intercepted = interception !== undefined && after !== current - currentLost
    if (intercepted) unspent.shift()
    rebased ||= intercepted
    const result = {
      ...application,
      appliedAmount: temporaryLost + current - after,
      beforeCurrentHitPoints: current,
      afterCurrentHitPoints: after,
      beforeTemporaryHitPoints: temporary,
      afterTemporaryHitPoints: temporary - temporaryLost,
      ...(intercepted && { interceptedBy: interception.effectId })
    }
    current = after
    temporary -= temporaryLost
    return result
  })
}
