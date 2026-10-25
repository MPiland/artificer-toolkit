import type { FacetAuthored } from '@artificer-toolkit/shared/authored'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

import { normalizeCharacterGrantRestrictions } from '../../character/characterGrantFoldRestrictionFacts.js'
import type { EnemyProximity } from '../../encounterEnemyProximity.js'
import type { MoveToward } from '../../encounterMoveToward.js'
import { dnd5eItemRequirementsMet, type Dnd5eAttackingItem } from './modifierApplicability.js'

export type Dnd5eAttackRollMode = string

/** What an attack decides when it rolls, which its path restrictions are held against. */
export type Dnd5eAttackCircumstances = {
  rollMode: Dnd5eAttackRollMode
  /** Null when the attack has no Scene to measure on, so an enemy-distance check cannot be answered. */
  enemyProximity: EnemyProximity | null
  /** Null when the attack has no Scene to measure on, so a movement check cannot be answered. */
  moveToward: MoveToward | null
  /** The creature type of the target; null for a target with none, such as a Character. */
  targetCreatureTypeId: string | null
}

type Restrictions = FacetAuthored
type Group = Restrictions['groups'][number]
type Context = Group['contexts'][number]
type Condition = NonNullable<Context['conditions']>[number]
type RollModeCondition = Extract<Condition, { predicateCode: 'ATTACK_ROLL_MODE' }>
type MoveTowardCondition = Extract<Condition, { predicateCode: 'MOVED_TOWARD_TARGET' }>
type CreatureTypeCondition = Extract<Condition, { predicateCode: 'CREATURE_TYPE' }>
type EnemyNearCondition = Extract<Condition, { predicateCode: 'ENEMY_NEAR_TARGET' }>
type DamageTypeCondition = Extract<Condition, { predicateCode: 'DAMAGE_TYPE' }>
type CircumstanceCondition =
  | RollModeCondition
  | EnemyNearCondition
  | MoveTowardCondition
  | CreatureTypeCondition

function isEnemyNearCondition(condition: Condition): condition is EnemyNearCondition {
  return condition.kind === 'PREDICATE' && condition.predicateCode === 'ENEMY_NEAR_TARGET'
}

function isMoveTowardCondition(condition: Condition): condition is MoveTowardCondition {
  return condition.kind === 'PREDICATE' && condition.predicateCode === 'MOVED_TOWARD_TARGET'
}

function isCreatureTypeCondition(condition: Condition): condition is CreatureTypeCondition {
  return condition.kind === 'PREDICATE' && condition.predicateCode === 'CREATURE_TYPE'
}

/** A check on the damage the attack deals, settled with the weapon's own checks. */
function isDamageTypeCondition(
  context: Context,
  condition: Condition
): condition is DamageTypeCondition {
  return (
    context.subject === 'EQUIPMENT' &&
    condition.kind === 'PREDICATE' &&
    condition.predicateCode === 'DAMAGE_TYPE'
  )
}

/** Whether every damage-type check of a group holds for the damage types the hit deals. */
function damageTypeChecksMet(group: Group, dealtDamageTypeIds: ReadonlySet<string>): boolean {
  return group.contexts.every((context) =>
    (context.conditions ?? []).every((condition) => {
      if (!isDamageTypeCondition(context, condition)) return true
      const matches =
        condition.authoringModeKind === 'ALL'
          ? dealtDamageTypeIds.size > 0
          : condition.damageTypeIds.some((id) => dealtDamageTypeIds.has(id))
      return condition.constraint === 'INCLUDE' ? matches : !matches
    })
  )
}

/**
 * The checks an attack decides at the moment it rolls, rather than from the weapon it holds: its
 * net roll mode, the enemies near its target, how far it closed on its target, and the creature
 * type of the target.
 */
function isCircumstanceCondition(
  context: Context,
  condition: Condition
): condition is CircumstanceCondition {
  return (
    (condition.kind === 'PREDICATE' && condition.predicateCode === 'ATTACK_ROLL_MODE') ||
    isEnemyNearCondition(condition) ||
    isMoveTowardCondition(condition) ||
    (context.subject === 'CREATURE' && isCreatureTypeCondition(condition))
  )
}

/**
 * The context without its circumstance and damage-type checks; a target context left with none no
 * longer constrains the weapon.
 */
function withoutCircumstanceConditions(context: Context): Context | null {
  const { conditions, ...rest } = context
  const kept = (conditions ?? []).filter(
    (condition) =>
      !isCircumstanceCondition(context, condition) && !isDamageTypeCondition(context, condition)
  )
  if (kept.length === 0 && context.subject === 'CREATURE') return null
  return (kept.length > 0 ? { ...rest, conditions: kept } : rest) as Context
}

/** A group's circumstance checks, the only ones left once the weapon's own are settled. */
function circumstanceContexts(group: Group): Context[] {
  return group.contexts.flatMap((context) => {
    const conditions = (context.conditions ?? []).filter((condition) =>
      isCircumstanceCondition(context, condition)
    )
    return conditions.length > 0 ? [{ ...context, conditions } as Context] : []
  })
}

const WEAPON_CHECK_KINDS: ReadonlySet<string> = new Set([
  'ITEM_IDENTITY',
  'ITEM_CATEGORY',
  'ITEM_PROPERTY',
  'ITEM_SOLE_WEAPON'
])

/**
 * Resolves the weapon checks of an attack's restrictions against the weapon it is made with, and
 * its damage-type checks against the damage types its hit deals, leaving only the circumstance checks (roll mode, nearby enemies, target creature type), which are
 * decided when the attack rolls. A group whose weapon checks fail can never hold and is dropped; a
 * group with nothing left to decide always holds, as does a facet without groups. Returns `null`
 * when the restrictions can never be met and `undefined` when they always are. Only the attacking
 * item's own checks are evaluated: a check the item cannot
 * answer (`ATTACK_ABILITY`, another subject's check) fails its group whatever its constraint.
 */
function reduceRestrictions(
  restrictions: Restrictions,
  item: Dnd5eAttackingItem | null,
  dealtDamageTypeIds: ReadonlySet<string>
): Restrictions | null | undefined {
  if (restrictions.groups.length === 0) return undefined
  const groups: Group[] = []
  for (const group of restrictions.groups) {
    if (!damageTypeChecksMet(group, dealtDamageTypeIds)) continue
    const weaponContexts = group.contexts.flatMap(
      (context) => withoutCircumstanceConditions(context) ?? []
    )
    const weaponChecks = normalizeCharacterGrantRestrictions({
      id: restrictions.id,
      groups: [{ ...group, contexts: weaponContexts }]
    })
    const [{ conditions }] = weaponChecks as [(typeof weaponChecks)[number]]
    if (
      weaponContexts.some((context) => context.subject !== 'EQUIPMENT') ||
      conditions.some((condition) => !WEAPON_CHECK_KINDS.has(condition.kind))
    )
      continue
    if (
      conditions.length > 0 &&
      !dnd5eItemRequirementsMet(weaponChecks, { item, attackAbility: null, activation: null })
    )
      continue
    const contexts = circumstanceContexts(group)
    if (contexts.length === 0) return undefined
    groups.push({ ...group, contexts })
  }
  return groups.length === 0 ? null : { ...restrictions, groups }
}

/**
 * Settles every path restriction of a compiled attack Effect against the weapon it is made with
 * and the damage its hit always deals (its `ON_HIT` damage that no restriction, use limit or player
 * choice withholds), so only the circumstance checks remain for {@link attackRestrictionsMet}. An
 * entry that can never be owed is removed. An `ON_USE` entry's restrictions admit the action's user
 * instead (the compiled entry's `holderRestrictions`) and stay as authored.
 */
export function reduceEffectRestrictions<TEffect extends CompiledEffectGroup>(
  effect: TEffect,
  item: Dnd5eAttackingItem | null
): TEffect {
  if (
    !effect.entries.some(
      (entry) => 'restrictions' in entry && entry.restrictions && entry.pathCode !== 'ON_USE'
    )
  )
    return effect
  const dealtDamageTypeIds = new Set(
    effect.entries.flatMap((entry) =>
      'outcome' in entry &&
      entry.pathCode === 'ON_HIT' &&
      entry.outcome.effectKind === 'DAMAGE' &&
      entry.outcome.damageTypeId !== undefined &&
      !entry.restrictions &&
      !entry.usage &&
      !entry.optionalRider
        ? [entry.outcome.damageTypeId]
        : []
    )
  )
  const entries = effect.entries.flatMap((entry) => {
    if (!('restrictions' in entry) || !entry.restrictions || entry.pathCode === 'ON_USE')
      return [entry]
    const restrictions = reduceRestrictions(entry.restrictions, item, dealtDamageTypeIds)
    if (restrictions === null) return []
    const { restrictions: _settled, ...unrestricted } = entry
    return [restrictions === undefined ? unrestricted : { ...unrestricted, restrictions }]
  })
  return { ...effect, entries }
}

function circumstanceMet(
  condition: CircumstanceCondition,
  circumstances: Dnd5eAttackCircumstances
): boolean {
  let matches: boolean
  if (isCreatureTypeCondition(condition)) {
    const { targetCreatureTypeId } = circumstances
    matches =
      condition.authoringModeKind === 'ALL' ||
      (targetCreatureTypeId !== null && condition.creatureTypeIds.includes(targetCreatureTypeId))
  } else if (isEnemyNearCondition(condition)) {
    // Without a Scene the check has no answer, so it fails whatever its constraint.
    if (!circumstances.enemyProximity) return false
    const { nearestFeet } = circumstances.enemyProximity
    matches = nearestFeet !== null && nearestFeet <= condition.feet
  } else if (isMoveTowardCondition(condition)) {
    if (!circumstances.moveToward) return false
    matches = circumstances.moveToward.closedFeet >= condition.minFeet
  } else {
    const { rollMode } = circumstances
    matches =
      condition.negated === true ? rollMode !== condition.rollMode : rollMode === condition.rollMode
  }
  return condition.constraint === 'INCLUDE' ? matches : !matches
}

/**
 * Whether reduced restrictions hold for an attack in the given circumstances: any group, with all
 * of its circumstance checks.
 */
export function attackRestrictionsMet(
  restrictions: Restrictions,
  circumstances: Dnd5eAttackCircumstances
): boolean {
  return restrictions.groups.some((group) =>
    group.contexts.every((context) =>
      (context.conditions ?? []).every((condition) => {
        if (!isCircumstanceCondition(context, condition))
          throw new Error('Attack restrictions must be reduced to circumstance checks.')
        return circumstanceMet(condition, circumstances)
      })
    )
  )
}

type CompiledEntry = CompiledEffectGroup['entries'][number]

/**
 * What a once-per-turn entry spends: the use of the Feature that grants it when it rides on an
 * attack as a rider, the use of its own Effect otherwise. Null for an entry without a usage limit.
 */
export function oncePerTurnUsageKey(entry: CompiledEntry, effectId: string): string | null {
  return 'usage' in entry && entry.usage ? (entry.usageKey ?? effectId) : null
}

/** Every use an attack spends: its once-per-turn entries that were dealt, by sorted usage key. */
export function spentTurnUses(
  effect: Pick<CompiledEffectGroup, 'id' | 'entries'>,
  dealtEntryIds: ReadonlySet<string>
): string[] {
  return [
    ...new Set(
      effect.entries.flatMap((entry) => {
        const key = oncePerTurnUsageKey(entry, effect.id)
        return key !== null && dealtEntryIds.has(entry.entryId) ? [key] : []
      })
    )
  ].sort()
}

/** Whether any path of a compiled attack Effect is limited to one use each turn. */
export function effectReadsTurnUses(effect: Pick<CompiledEffectGroup, 'entries'>): boolean {
  return effect.entries.some((entry) => 'usage' in entry && entry.usage !== undefined)
}

/** Whether any path of a compiled attack Effect asks how far the attacker closed on the target. */
export function effectReadsMoveToward(effect: Pick<CompiledEffectGroup, 'entries'>): boolean {
  return effect.entries.some(
    (entry) =>
      'restrictions' in entry &&
      entry.restrictions?.groups.some((group) =>
        group.contexts.some((context) => (context.conditions ?? []).some(isMoveTowardCondition))
      )
  )
}

/** Whether any path of a compiled attack Effect asks how near an enemy stands to the target. */
export function effectReadsEnemyProximity(effect: Pick<CompiledEffectGroup, 'entries'>): boolean {
  return effect.entries.some(
    (entry) =>
      'restrictions' in entry &&
      entry.restrictions?.groups.some((group) =>
        group.contexts.some((context) => (context.conditions ?? []).some(isEnemyNearCondition))
      )
  )
}
