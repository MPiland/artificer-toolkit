import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { damageInterceptionPayloadDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import {
  resolveDispositionDamage,
  type DamageInterceptionSaveDto
} from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'

import {
  temporaryHitPointsAfterGrant,
  temporaryHitPointsAfterLoss,
  temporaryHitPointsAfterRelease,
  type TemporaryHitPointsPool
} from '@artificer-toolkit/schema/shared/temporaryHitPoints'

import {
  effectiveHitPointMaximum,
  listActiveEffectGrants
} from './character/activeEffectGrantTotals.js'
import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import { EncounterValidationError } from './encounterErrors.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'

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
  /** The save the holder must pass to be intercepted; its DC may grow with the damage taken. */
  save?: { ability: string; dc: { base: number; plusDamageTaken: boolean } }
  /** Damage this interception does not meet (`DamageInterceptionSubscription`). */
  excludes?: { damageTypeIds: readonly string[]; critical: boolean }
  maxDamageTaken?: number
}

/**
 * One save die the caller rolled for a save an interception asks of its holder: the kept d20 and the
 * signed total of its added dice. A batch carries them in the order its interceptions ask (see
 * `hitPointsAfterDamage`).
 */
export type InterceptionSaveRoll = { rawDie: number; addedTotal: number }

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
              negatesKill: payload.negatesKill,
              ...(payload.save && { save: payload.save }),
              ...(payload.excludes && { excludes: payload.excludes }),
              ...(payload.maxDamageTaken !== undefined && {
                maxDamageTaken: payload.maxDamageTaken
              })
            }
          })
      )
    )
}

/**
 * The hit points damage leaves the holder at, and the interception that decided them: the first
 * unspent interception the damage's `BEFORE` event meets (it would drop the holder from above 0 to 0,
 * and its exclusions and damage cap admit the blow) holds it at its hit points; with none, the plain
 * result. `currentLost` is what the damage takes off current hit points after temporary hit points;
 * `damageTaken` is the whole blow, which sets a save's DC. An interception that asks a save is spent
 * only on a pass: each save takes the next of `saveRolls`, and a failure lets the blow meet the next
 * interception. `saves` records every save asked and `rollsUsed` how many dice they took.
 */
export function hitPointsAfterDamage(input: {
  current: number
  currentLost: number
  maximum: number
  damageTaken: number
  damageTypeId: string | null
  critical: boolean
  interceptions: readonly HeldDamageInterception[]
  saveRolls: readonly InterceptionSaveRoll[]
}) {
  const after = input.current - input.currentLost
  const met = discoverEncounterEventHooks({
    damageInterceptions: input.interceptions,
    events: [
      {
        kind: 'DAMAGED',
        phase: 'BEFORE',
        hitPoints: { before: input.current, after },
        damageTaken: input.damageTaken,
        damageTypeId: input.damageTypeId,
        critical: input.critical
      }
    ]
  }).damageInterceptions
  const saves: DamageInterceptionSaveDto[] = []
  for (const candidate of met) {
    if (candidate.save === undefined)
      return {
        after: Math.min(candidate.dropToHitPoints, input.maximum),
        interception: candidate,
        saves,
        rollsUsed: saves.length
      }
    const roll = input.saveRolls[saves.length]
    if (roll === undefined)
      throw new EncounterValidationError('A damage interception save has no die.')
    const dc = candidate.save.dc.base + (candidate.save.dc.plusDamageTaken ? input.damageTaken : 0)
    const passed = roll.rawDie + roll.addedTotal >= dc
    saves.push({ effectId: candidate.effectId, ...roll, dc, passed })
    if (passed)
      return {
        after: Math.min(candidate.dropToHitPoints, input.maximum),
        interception: candidate,
        saves,
        rollsUsed: saves.length
      }
  }
  return { after, interception: undefined, saves, rollsUsed: saves.length }
}

/** The first unspent interception that negates a kill about to land on its holder. */
export function killInterception(interceptions: readonly HeldDamageInterception[]) {
  return discoverEncounterEventHooks({
    damageInterceptions: interceptions,
    events: [{ kind: 'KILLED' }]
  }).damageInterceptions[0]
}

/**
 * Applies a batch's interceptions in order, the first lethal damage or kill spending each one: the
 * damage ends at the interception's hit points and names it (`interceptedBy`), a kill is replaced by
 * a `KILL_NEGATED` the same ward negates. Every later hit point change in the batch (damage, healing,
 * temporary hit points) is rebased onto the pools the interception left, so a second blow meets the
 * ward already spent. This is the one place a batch's interceptions are decided: the planner calls it,
 * and the fold only validates the result. Pure, and shared by every actor kind: a Character and a Run
 * creature settle damage through the same planner and fold.
 */
export function applyDamageInterceptions(input: {
  applications: readonly CharacterRuleActionApplication[]
  currentHitPoints: number
  temporaryHitPoints: number
  temporaryHitPointsSourceEffectId?: string | null
  interceptions: readonly HeldDamageInterception[]
  /** The save dice for the saves the interceptions ask, in the order they ask (`hitPointsAfterDamage`). */
  saveRolls?: readonly InterceptionSaveRoll[]
}): CharacterRuleActionApplication[] {
  if (input.interceptions.length === 0) return [...input.applications]
  const unspent = [...input.interceptions]
  let current = input.currentHitPoints
  let pool: TemporaryHitPointsPool = {
    amount: input.temporaryHitPoints,
    sourceEffectId: input.temporaryHitPointsSourceEffectId ?? null
  }
  let rebased = false
  let rollsUsed = 0
  return input.applications.map((application) => {
    if (application.kind === 'KILL') {
      const spent = killInterception(unspent)
      if (spent === undefined) {
        current = 0
        pool = { amount: 0, sourceEffectId: null }
        return application
      }
      unspent.splice(unspent.indexOf(spent), 1)
      const { kind: _kind, ...trace } = application
      return { ...trace, kind: 'KILL_NEGATED', negatedBy: spent.effectId }
    }
    if (application.kind === 'TEMPORARY_HIT_POINTS_RELEASE') {
      pool = temporaryHitPointsAfterRelease(pool, application.sourceActiveEffectId)
      return application
    }
    if (application.kind === 'HEAL') {
      const appliedAmount = rebased
        ? Math.min(application.resolvedAmount, application.maximumHitPoints - current)
        : application.appliedAmount
      const result = rebased
        ? {
            ...application,
            appliedAmount,
            beforeCurrentHitPoints: current,
            afterCurrentHitPoints: current + appliedAmount,
            beforeTemporaryHitPoints: pool.amount,
            afterTemporaryHitPoints: pool.amount
          }
        : application
      current = result.afterCurrentHitPoints
      return result
    }
    if (application.kind === 'TEMPORARY_HIT_POINTS') {
      const granted = temporaryHitPointsAfterGrant(pool, {
        amount: application.resolvedAmount,
        sourceEffectId: application.sourceActiveEffectId ?? null
      })
      const result = rebased
        ? {
            ...application,
            appliedAmount: granted.amount - pool.amount,
            beforeCurrentHitPoints: current,
            afterCurrentHitPoints: current,
            beforeTemporaryHitPoints: pool.amount,
            afterTemporaryHitPoints: granted.amount
          }
        : application
      pool = { amount: result.afterTemporaryHitPoints, sourceEffectId: granted.sourceEffectId }
      return result
    }
    if (application.kind !== 'DAMAGE') return application
    const resolvedAmount = resolveDispositionDamage(
      application.damageDisposition,
      application.requestedAmount
    )
    const temporaryLost = Math.min(pool.amount, resolvedAmount)
    const currentLost = Math.min(current, resolvedAmount - temporaryLost)
    const {
      after,
      interception,
      saves,
      rollsUsed: used
    } = hitPointsAfterDamage({
      current,
      currentLost,
      maximum: application.maximumHitPoints,
      damageTaken: resolvedAmount,
      damageTypeId: application.damageTypeId,
      critical: application.critical,
      interceptions: unspent,
      saveRolls: (input.saveRolls ?? []).slice(rollsUsed)
    })
    rollsUsed += used
    const intercepted = interception !== undefined
    if (intercepted) unspent.splice(unspent.indexOf(interception), 1)
    rebased ||= intercepted
    const result = {
      ...application,
      appliedAmount: temporaryLost + current - after,
      beforeCurrentHitPoints: current,
      afterCurrentHitPoints: after,
      beforeTemporaryHitPoints: pool.amount,
      afterTemporaryHitPoints: pool.amount - temporaryLost,
      ...(intercepted && { interceptedBy: interception.effectId }),
      ...(saves.length > 0 && { interceptionSaves: saves })
    }
    current = after
    pool = temporaryHitPointsAfterLoss(pool, temporaryLost)
    return result
  })
}

/**
 * Every batch input a holder's held effects derive: its effective maximum hit points and its damage
 * interceptions. Each mechanics batch builder calls this once for its target instead of computing
 * the maximum inline, so a new held-effect input reaches every flow at once.
 */
export function heldBatchInputs(input: {
  baseMaximumHitPoints: number
  effects: readonly ActiveRuleEffectRecord[]
}) {
  return {
    effectiveMaximumHitPoints: effectiveHitPointMaximum(input.baseMaximumHitPoints, input.effects),
    damageInterceptions: heldDamageInterceptions(input.effects)
  }
}
