import type { OptionalOnHitAuthored } from '@artificer-toolkit/shared/authored'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

type CompiledEffectEntry = Extract<CompiledEffectGroup['entries'][number], { outcome: unknown }>
type DamageEntry = CompiledEffectEntry & { outcome: { effectKind: 'DAMAGE' } }

/** A passive Feature's `ON_HIT` outcomes, owed to every attack its trigger names. */
export type OnHitRider = {
  riderId: string
  /** The name of the Feature, option or feat that grants it: how the player tells riders apart. */
  label: string
  triggerCode: CompiledEffectGroup['invocation']['triggerCode']
  /** Present when the player chooses whether the rider applies (D123); absent when it always does. */
  optionalOnHit?: OptionalOnHitAuthored
  /** Present when the rider rides only the attacks of this sibling Feature (D164 Charge). */
  ridesFeatureId?: string
  /** Present when the rider rides only the casts of these Spells (G4); such a rider rides no other attack. */
  ridesSpellIds?: readonly string[]
  entries: readonly CompiledEffectEntry[]
}

function isOnHitOutcome(
  entry: CompiledEffectGroup['entries'][number]
): entry is CompiledEffectEntry {
  return 'outcome' in entry && entry.pathCode === 'ON_HIT' && entry.resolutionKind === 'DIRECT'
}

function isOnHitDamage(entry: CompiledEffectGroup['entries'][number]): entry is DamageEntry {
  return isOnHitOutcome(entry) && entry.outcome.effectKind === 'DAMAGE'
}

/**
 * The `ON_HIT` outcomes of each passive Effect: they ride on the attack its trigger names. A rider
 * with a usage limit spends its owner's use (the Feature, option or feat that grants it), so
 * every Effect of that owner shares one. An Effect that still carries a closed rule is not yet
 * executable, so none of its outcomes ride: its gate or remainder would be lost (D156).
 */
export function collectOnHitRiders(
  effects: readonly CompiledEffectGroup[] | undefined,
  ownerId: string,
  label: string
): OnHitRider[] {
  return (effects ?? []).flatMap((effect) => {
    if (
      effect.entries.some(
        (entry) => 'outcome' in entry && entry.outcome.effectKind === 'CLOSED_RULE'
      )
    )
      return []
    const entries = effect.entries
      .filter(isOnHitOutcome)
      .map((entry) => (entry.usage ? { ...entry, usageKey: ownerId } : entry))
    return effect.invocation.kind === 'PASSIVE' && entries.length > 0
      ? [
          {
            riderId: effect.id,
            label,
            triggerCode: effect.invocation.triggerCode,
            ...('optionalOnHit' in effect.invocation && effect.invocation.optionalOnHit
              ? { optionalOnHit: effect.invocation.optionalOnHit }
              : {}),
            ...('ridesFeatureId' in effect.invocation && effect.invocation.ridesFeatureId
              ? { ridesFeatureId: effect.invocation.ridesFeatureId }
              : {}),
            ...('ridesSpellIds' in effect.invocation && effect.invocation.ridesSpellIds
              ? { ridesSpellIds: effect.invocation.ridesSpellIds }
              : {}),
            entries
          }
        ]
      : []
  })
}

/**
 * Merges the riders whose trigger the attack shares into its own `ON_HIT` outcomes, so one hit
 * resolves one outcome (an optional rider's entries are marked, and resolve only when chosen): resistance, critical doubling and the dice rows treat a rider exactly as
 * the weapon's own damage. A rider that names the triggering weapon's damage type takes the type
 * of the attack's first `ON_HIT` damage. An attack with no `ON_HIT` damage takes no rider.
 *
 * A rider scoped to one Feature rides only that Feature's attacks, and joins the result block of the
 * attack's first `ON_HIT` damage as one sequence with it, so its damage and its follow-up save
 * resolve as part of the hit (D164 Charge). A rider that calls a follow-up save joins the hit the
 * same way, scoped or not (Stunning Strike). A rider scoped to Spells rides only the cast of one of
 * them, and `castSpellId` names the Spell a cast is of (a Feature's attack names none).
 */
export function mergeOnHitRiders<TEffect extends CompiledEffectGroup>(
  effect: TEffect,
  riders: readonly OnHitRider[],
  attackFeatureId: string | undefined,
  castSpellId?: string
): TEffect {
  if (effect.invocation.kind === 'PASSIVE') return effect
  const { triggerCode } = effect.invocation
  const matching = riders.filter(
    (rider) =>
      rider.triggerCode === triggerCode &&
      (rider.ridesFeatureId === undefined || rider.ridesFeatureId === attackFeatureId) &&
      (rider.ridesSpellIds === undefined ||
        (castSpellId !== undefined && rider.ridesSpellIds.includes(castSpellId)))
  )
  const [weaponDamage] = effect.entries
    .filter(isOnHitDamage)
    .filter((entry) => entry.outcome.damageTypeId !== undefined)
    .sort((left, right) => left.pathOrder - right.pathOrder || left.entryOrder - right.entryOrder)
  const weaponDamageTypeId = weaponDamage?.outcome.damageTypeId
  if (matching.length === 0 || !weaponDamage || weaponDamageTypeId === undefined) return effect
  const lastEntryOrder = Math.max(
    ...effect.entries.map((entry) => entry.entryOrder),
    weaponDamage.entryOrder
  )
  // A Feature-scoped rider, or any rider beside a rider that calls a save, resolves as part of the hit.
  const joinsHit = matching.some(
    (rider) =>
      rider.ridesFeatureId !== undefined ||
      rider.entries.some((entry) => entry.outcome.effectKind === 'FOLLOW_UP_SAVE')
  )
  // A Feature acquired from two sources collects twice; its rider still applies once.
  const merged = [
    ...new Map(
      matching.flatMap((rider) =>
        rider.entries.map((entry) => [entry.id, { rider, entry }] as const)
      )
    ).values()
  ].map(({ rider, entry }): CompiledEffectEntry => ({
    ...entry,
    pathGroupId: weaponDamage.pathGroupId,
    pathOrder: weaponDamage.pathOrder,
    entryOrder: lastEntryOrder + entry.entryOrder,
    outcome: withWeaponDamageType(entry.outcome, weaponDamageTypeId),
    ...(rider.optionalOnHit
      ? { optionalRider: { riderId: rider.riderId, label: rider.label, cost: rider.optionalOnHit } }
      : {}),
    ...(joinsHit
      ? { resultBlockId: weaponDamage.resultBlockId, groupKind: 'SEQUENTIAL' as const }
      : {})
  }))
  const sequenced = joinsHit
    ? effect.entries.map((entry) =>
        'resultBlockId' in entry && entry.resultBlockId === weaponDamage.resultBlockId
          ? { ...entry, groupKind: 'SEQUENTIAL' as const }
          : entry
      )
    : effect.entries
  return { ...effect, entries: [...sequenced, ...merged] }
}

function withWeaponDamageType(
  outcome: CompiledEffectEntry['outcome'],
  weaponDamageTypeId: string
): CompiledEffectEntry['outcome'] {
  if (outcome.effectKind !== 'DAMAGE' || !outcome.usesTriggeringWeaponDamageType) return outcome
  const { usesTriggeringWeaponDamageType: _riderChoice, ...named } = outcome
  return { ...named, damageTypeId: weaponDamageTypeId }
}
