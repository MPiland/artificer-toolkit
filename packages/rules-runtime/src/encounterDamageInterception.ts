import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  createCharacterResourceOwnerKey,
  type CharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'
import {
  damageInterceptionPayloadDtoSchema,
  type DamageInterceptionPayloadDto
} from '@artificer-toolkit/schema/grants/modifier'
import {
  resolveIncomingDamage,
  type DamageInterceptionChargeDto,
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
import { resourceOwner } from './character/characterNativeActionResources.js'
import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import { holderStateRestrictionsHold } from './encounterActiveGrants.js'
import { withFeatureChargeUsed } from './encounterActorState.js'
import { EncounterValidationError } from './encounterErrors.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'

/**
 * A held `DAMAGE_INTERCEPTION` grant (Death Ward; Undead Fortitude and Relentless reuse it): damage
 * that would drop the holder to 0 hit points leaves it at `dropToHitPoints`, and an instant-death
 * effect is negated when `negatesKill`. An effect-held interception spends one of the holding
 * effect's `uses`; the last use ends the effect (persistence, like attack decoys). A feature-held
 * one (`charge` set) spends a charge of the feature instead, and is spent for good only if the
 * feature has none left to give; a feature with no charge is held every time.
 */
export type HeldDamageInterception = {
  /** The holding effect's id, or the holding feature's id for a feature-held interception. */
  effectId: string
  /**
   * The limited-use feature charge this interception spends, with its counts as they stand; a
   * Character's names its Sheet resource pool.
   */
  charge?: {
    ownerFeatureId: string
    owner?: CharacterResourceOwnerKey
    chargeId: string
    cost: number
    used: number
    amount: number
  }
  /** The holder's save die for the save this interception asks, rolled before the blow lands. */
  saveRoll?: InterceptionSaveRoll
  dropToHitPoints: number
  negatesKill: boolean
  /**
   * The save the holder must pass to be intercepted; its DC may grow with the damage taken and the
   * charges already used, and a failure may still spend the use.
   */
  save?: DamageInterceptionPayloadDto['save']
  /** Damage this interception does not meet (`DamageInterceptionSubscription`). */
  excludes?: { damageTypeIds: readonly string[]; critical: boolean }
  maxDamageTaken?: number
}

/**
 * One save die the caller rolled for a save an interception asks of its holder: the kept d20 and the
 * signed total of everything added to it (the save modifier and any added dice).
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
 * One of a holder's feature resources as its rules report it: the cap and what is spent. A
 * Character's names its Sheet resource pool; a Creature's lives on its actor.
 */
export type FeatureChargeAvailability = {
  featureId: string
  /** The feature's charge identity; null for a feature that has no charge. */
  chargeId: string | null
  owner?: CharacterResourceOwnerKey
  maximum: number | null
  used: number
}

/** A Character's feature-held interceptions; a feature's charge spends its resolved Sheet pool. */
export function characterHeldDamageInterceptions(
  policyOutput: CharacterRulePolicyOutput,
  activeAuthoredEffectIds: readonly string[]
): HeldDamageInterception[] {
  return featureHeldDamageInterceptions({
    modifiers: policyOutput.grantFold.modifiers,
    featureResources: policyOutput.resources.flatMap((resource) =>
      resource.ownerKind === 'AUTHORED_SOURCE' &&
      resource.state === 'RESOLVED' &&
      resource.source.kind === 'AUTHORED'
        ? [
            {
              featureId: resource.source.definitionId,
              chargeId: resource.chargeId,
              owner: resourceOwner(resource),
              maximum: resource.maximum,
              used: resource.rawUsed
            }
          ]
        : []
    ),
    activeAuthoredEffectIds
  })
}

/**
 * The interceptions a holder's passive features hold (`DAMAGE_INTERCEPTION` feature grants, Undead
 * Fortitude, Relentless and Relentless Rage), in feature then grant id order so every replay picks
 * the same. A grant bound to the holder's own active effect (HOLDER_ACTIVE_EFFECT: Relentless Rage
 * while raging) is held only while it is active; its other deferred holder conditions fail closed.
 * A feature with a charge is held while it has one left and spends one when it intercepts; a
 * feature with none is held every time.
 */
export function featureHeldDamageInterceptions(input: {
  modifiers: CharacterGrantFoldOutput['modifiers']
  featureResources: readonly FeatureChargeAvailability[]
  activeAuthoredEffectIds: readonly string[]
}): HeldDamageInterception[] {
  return input.modifiers
    .flatMap((modifier) =>
      modifier.valueDomainCode === 'DAMAGE_INTERCEPTION' &&
      modifier.source.kind === 'AUTHORED' &&
      holderStateRestrictionsHold(modifier.deferredRequirements, {
        activeAuthoredEffectIds: input.activeAuthoredEffectIds
      })
        ? [{ modifier, featureId: modifier.source.definitionId }]
        : []
    )
    .sort(
      (left, right) =>
        left.featureId.localeCompare(right.featureId) ||
        left.modifier.grantId.localeCompare(right.modifier.grantId)
    )
    .flatMap(({ modifier, featureId }) => {
      const resource = input.featureResources.find((entry) => entry.featureId === featureId)
      const payload = damageInterceptionPayloadDtoSchema.parse(modifier.payload)
      const held = {
        effectId: featureId,
        dropToHitPoints: payload.dropToHitPoints,
        negatesKill: payload.negatesKill,
        ...(payload.save && { save: payload.save }),
        ...(payload.excludes && { excludes: payload.excludes }),
        ...(payload.maxDamageTaken !== undefined && { maxDamageTaken: payload.maxDamageTaken })
      }
      if (resource?.chargeId == null) return [held]
      // A charge the rules cannot size is not given out.
      if (resource.maximum === null || resource.maximum - resource.used < 1) return []
      return [
        {
          ...held,
          charge: {
            ownerFeatureId: featureId,
            ...(resource.owner !== undefined && { owner: resource.owner }),
            chargeId: resource.chargeId,
            cost: 1,
            used: resource.used,
            amount: resource.maximum
          }
        }
      ]
    })
}

/**
 * The hit points damage leaves the holder at, and the interception that decided them: the first
 * unspent interception the damage's `BEFORE` event meets (it would drop the holder from above 0 to 0,
 * and its exclusions and damage cap admit the blow) holds it at its hit points; with none, the plain
 * result. `currentLost` is what the damage takes off current hit points after temporary hit points;
 * `damageTaken` is the whole blow, which sets a save's DC with the charges its feature already used.
 * An interception that asks a save is spent on a pass, with the die it carries (`saveRoll`); a
 * failure lets the blow meet the next interception, and spends the use too when the interception
 * counts every attempt (`spendsUseOnFailure`). `saves` records every save asked; `attempted` is
 * every interception the blow spent, the deciding one last.
 */
export function hitPointsAfterDamage(input: {
  current: number
  currentLost: number
  maximum: number
  damageTaken: number
  damageTypeId: string | null
  critical: boolean
  interceptions: readonly HeldDamageInterception[]
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
  const attempted: HeldDamageInterception[] = []
  const intercepted = (candidate: HeldDamageInterception) => ({
    after: Math.min(candidate.dropToHitPoints, input.maximum),
    interception: candidate,
    saves,
    attempted: [...attempted, candidate]
  })
  for (const candidate of met) {
    const { save } = candidate
    if (save === undefined) return intercepted(candidate)
    const roll = candidate.saveRoll
    if (roll === undefined)
      throw new EncounterValidationError('A damage interception save has no die.')
    const dc =
      save.dc.base +
      (save.dc.plusDamageTaken ? input.damageTaken : 0) +
      save.dc.plusPerChargeUsed * (candidate.charge?.used ?? 0)
    const passed = roll.rawDie + roll.addedTotal >= dc
    const spentOnFailure = !passed && save.spendsUseOnFailure
    const charge = spentOnFailure ? interceptionChargeReceipt(candidate) : undefined
    saves.push({
      effectId: candidate.effectId,
      ...roll,
      dc,
      passed,
      ...(spentOnFailure && { spent: true as const }),
      ...(charge && { charge })
    })
    if (passed) return intercepted(candidate)
    if (spentOnFailure) attempted.push(candidate)
  }
  return { after, interception: undefined, saves, attempted }
}

/**
 * The charge receipt a spent feature-held interception writes on its application, or undefined for
 * an effect-held one. The planner writes it and the fold recomputes it, so both read the same counts.
 */
export function interceptionChargeReceipt(
  spent: HeldDamageInterception
): DamageInterceptionChargeDto | undefined {
  const { charge } = spent
  if (charge === undefined) return undefined
  return {
    ownerFeatureId: charge.ownerFeatureId,
    ...(charge.owner !== undefined && { poolId: createCharacterResourceOwnerKey(charge.owner) }),
    chargeId: charge.chargeId,
    cost: charge.cost,
    beforeUsed: charge.used,
    afterUsed: charge.used + charge.cost,
    beforeRemaining: charge.amount - charge.used,
    afterRemaining: charge.amount - charge.used - charge.cost
  }
}

type InterceptionReceiptApplication = {
  kind: string
  interceptionSaves?: readonly DamageInterceptionSaveDto[]
  interceptionCharge?: DamageInterceptionChargeDto
}

/**
 * Every feature charge a batch's interceptions spent, in spend order: each application's failed
 * attempts that counted (`DamageInterceptionSaveDto.charge`), then the interception that held it.
 */
export function interceptionChargesSpent(
  applications: readonly InterceptionReceiptApplication[]
): DamageInterceptionChargeDto[] {
  return applications.flatMap(({ interceptionSaves, interceptionCharge }) => [
    ...(interceptionSaves ?? []).flatMap(({ charge }) => (charge ? [charge] : [])),
    ...(interceptionCharge ? [interceptionCharge] : [])
  ])
}

/**
 * The actor with the feature charges its batch's interceptions spent marked used, so the plan carries
 * the spend and persistence writes it with the rest of the actor.
 */
export function withInterceptionChargesSpent<TActor extends { resources?: unknown }>(
  actor: TActor,
  applications: readonly InterceptionReceiptApplication[]
): TActor {
  const spent = interceptionChargesSpent(applications)
  if (spent.length === 0) return actor
  return {
    ...actor,
    resources: spent.reduce(
      (resources, charge) =>
        withFeatureChargeUsed({ resources }, charge.ownerFeatureId, charge.afterUsed),
      actor.resources
    )
  }
}

/** Whether a recorded charge receipt is the one the spent interception writes. */
export function interceptionChargeMatches(
  recorded: DamageInterceptionChargeDto | undefined,
  spent: HeldDamageInterception | undefined
) {
  return chargeReceiptsMatch(recorded, spent && interceptionChargeReceipt(spent))
}

/** Whether the saves a damage application records are the ones its interceptions asked. */
export function interceptionSavesMatch(
  recorded: readonly DamageInterceptionSaveDto[],
  expected: readonly DamageInterceptionSaveDto[]
) {
  return (
    recorded.length === expected.length &&
    expected.every((save, index) => {
      const entry = recorded[index]
      return (
        entry?.effectId === save.effectId &&
        entry.rawDie === save.rawDie &&
        entry.addedTotal === save.addedTotal &&
        entry.dc === save.dc &&
        entry.passed === save.passed &&
        entry.spent === save.spent &&
        chargeReceiptsMatch(entry.charge, save.charge)
      )
    })
  )
}

function chargeReceiptsMatch(
  recorded: DamageInterceptionChargeDto | undefined,
  expected: DamageInterceptionChargeDto | undefined
) {
  return recorded === undefined
    ? expected === undefined
    : expected !== undefined &&
        recorded.ownerFeatureId === expected.ownerFeatureId &&
        recorded.poolId === expected.poolId &&
        recorded.chargeId === expected.chargeId &&
        recorded.cost === expected.cost &&
        recorded.beforeUsed === expected.beforeUsed &&
        recorded.afterUsed === expected.afterUsed &&
        recorded.beforeRemaining === expected.beforeRemaining &&
        recorded.afterRemaining === expected.afterRemaining
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
 * creature settle damage through the same planner and fold. An invulnerable target's damage settles
 * here too, as IMMUNE at 0 with no interception spent; the fold asks for that itself, so every flow
 * that folds the target's damage agrees.
 */
export function applyDamageInterceptions(input: {
  applications: readonly CharacterRuleActionApplication[]
  currentHitPoints: number
  temporaryHitPoints: number
  temporaryHitPointsSourceEffectId?: string | null
  interceptions: readonly HeldDamageInterception[]
  /** The target takes no damage (`encounterActorBody`): every damage is IMMUNE. */
  invulnerable?: boolean
}): CharacterRuleActionApplication[] {
  if (input.interceptions.length === 0 && !input.invulnerable) return [...input.applications]
  const unspent = [...input.interceptions]
  let current = input.currentHitPoints
  let pool: TemporaryHitPointsPool = {
    amount: input.temporaryHitPoints,
    sourceEffectId: input.temporaryHitPointsSourceEffectId ?? null
  }
  let rebased = false
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
      const interceptionCharge = interceptionChargeReceipt(spent)
      return {
        ...trace,
        kind: 'KILL_NEGATED',
        negatedBy: spent.effectId,
        ...(interceptionCharge && { interceptionCharge })
      }
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
    // A planned interception is decided again here, against the pools this batch leaves.
    const {
      interceptedBy: _interceptedBy,
      interceptionSaves: _interceptionSaves,
      interceptionCharge: _interceptionCharge,
      ...planned
    } = application
    const damageDisposition = input.invulnerable ? 'IMMUNE' : planned.damageDisposition
    const resolvedAmount = resolveIncomingDamage({ ...planned, damageDisposition })
    const temporaryLost = Math.min(pool.amount, resolvedAmount)
    const currentLost = Math.min(current, resolvedAmount - temporaryLost)
    const { after, interception, saves, attempted } = hitPointsAfterDamage({
      current,
      currentLost,
      maximum: application.maximumHitPoints,
      damageTaken: resolvedAmount,
      damageTypeId: application.damageTypeId,
      critical: application.critical,
      interceptions: unspent
    })
    const intercepted = interception !== undefined
    for (const spent of attempted) unspent.splice(unspent.indexOf(spent), 1)
    const interceptionCharge = interception && interceptionChargeReceipt(interception)
    const result = {
      ...planned,
      damageDisposition,
      resolvedAmount,
      appliedAmount: temporaryLost + current - after,
      beforeCurrentHitPoints: current,
      afterCurrentHitPoints: after,
      beforeTemporaryHitPoints: pool.amount,
      afterTemporaryHitPoints: pool.amount - temporaryLost,
      ...(intercepted && { interceptedBy: interception.effectId }),
      ...(saves.length > 0 && { interceptionSaves: saves }),
      ...(interceptionCharge && { interceptionCharge })
    }
    rebased ||=
      result.afterCurrentHitPoints !== application.afterCurrentHitPoints ||
      result.afterTemporaryHitPoints !== application.afterTemporaryHitPoints
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
  /** A Creature's feature-held interceptions (`featureHeldDamageInterceptions`), after its effects'. */
  featureInterceptions?: readonly HeldDamageInterception[]
}) {
  return {
    effectiveMaximumHitPoints: effectiveHitPointMaximum(input.baseMaximumHitPoints, input.effects),
    damageInterceptions: [
      ...heldDamageInterceptions(input.effects),
      ...(input.featureInterceptions ?? [])
    ]
  }
}
