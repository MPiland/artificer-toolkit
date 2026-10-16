import type { FacetAuthored } from '@artificer-toolkit/shared/authored'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

import { normalizeCharacterGrantRestrictions } from '../../character/characterGrantFoldRestrictionFacts.js'
import { dnd5eItemRequirementsMet, type Dnd5eAttackingItem } from './modifierApplicability.js'

export type Dnd5eAttackRollMode = 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'

/**
 * Who stands near an attack's target, from the Scene: the distance in feet to the nearest creature
 * hostile to the target and able to act, or `null` when there is none.
 */
export type Dnd5eEnemyProximity = { nearestFeet: number | null }

/** What an attack decides when it rolls, which its path restrictions are held against. */
export type Dnd5eAttackCircumstances = {
  rollMode: Dnd5eAttackRollMode
  /** Null when the attack has no Scene to measure on, so an enemy-distance check cannot be answered. */
  enemyProximity: Dnd5eEnemyProximity | null
}

type Restrictions = FacetAuthored
type Group = Restrictions['groups'][number]
type Context = Group['contexts'][number]
type Condition = NonNullable<Context['conditions']>[number]
type RollModeCondition = Extract<Condition, { predicateCode: 'ATTACK_ROLL_MODE' }>
type EnemyNearCondition = Extract<Condition, { predicateCode: 'ENEMY_NEAR_TARGET' }>
type CircumstanceCondition = RollModeCondition | EnemyNearCondition

function isEnemyNearCondition(condition: Condition): condition is EnemyNearCondition {
  return condition.kind === 'PREDICATE' && condition.predicateCode === 'ENEMY_NEAR_TARGET'
}

/** The checks an attack decides at the moment it rolls, rather than from the weapon it holds. */
function isCircumstanceCondition(condition: Condition): condition is CircumstanceCondition {
  return (
    (condition.kind === 'PREDICATE' && condition.predicateCode === 'ATTACK_ROLL_MODE') ||
    isEnemyNearCondition(condition)
  )
}

function withoutCircumstanceConditions(context: Context): Context {
  const { conditions, ...rest } = context
  const kept = (conditions ?? []).filter((condition) => !isCircumstanceCondition(condition))
  return (kept.length > 0 ? { ...rest, conditions: kept } : rest) as Context
}

/** A group's circumstance checks, the only ones left once the weapon's own are settled. */
function circumstanceContexts(group: Group): Context[] {
  return group.contexts.flatMap((context) => {
    const conditions = (context.conditions ?? []).filter(isCircumstanceCondition)
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
 * Resolves the weapon checks of an attack's restrictions against the weapon it is made with,
 * leaving only the circumstance checks (roll mode, nearby enemies), which are decided when the attack rolls. A group whose weapon
 * checks fail can never hold and is dropped; a group with nothing left to decide always holds, as
 * does a facet without groups. Returns `null` when the restrictions can never be met and `undefined`
 * when they always are. Only the attacking item's own checks are evaluated: a check the item cannot
 * answer (`ATTACK_ABILITY`, another subject's check) fails its group whatever its constraint.
 */
function reduceRestrictions(
  restrictions: Restrictions,
  item: Dnd5eAttackingItem | null
): Restrictions | null | undefined {
  if (restrictions.groups.length === 0) return undefined
  const groups: Group[] = []
  for (const group of restrictions.groups) {
    const weaponChecks = normalizeCharacterGrantRestrictions({
      id: restrictions.id,
      groups: [{ ...group, contexts: group.contexts.map(withoutCircumstanceConditions) }]
    })
    const [{ conditions }] = weaponChecks as [(typeof weaponChecks)[number]]
    if (
      group.contexts.some((context) => context.subject !== 'EQUIPMENT') ||
      conditions.some((condition) => !WEAPON_CHECK_KINDS.has(condition.kind))
    )
      continue
    if (conditions.length > 0 && !dnd5eItemRequirementsMet(weaponChecks, item, null)) continue
    const contexts = circumstanceContexts(group)
    if (contexts.length === 0) return undefined
    groups.push({ ...group, contexts })
  }
  return groups.length === 0 ? null : { ...restrictions, groups }
}

/**
 * Settles every path restriction of a compiled attack Effect against the weapon it is made with,
 * so only the circumstance checks remain for {@link attackRestrictionsMet}. An entry that can never
 * be owed is removed.
 */
export function reduceEffectRestrictions<TEffect extends CompiledEffectGroup>(
  effect: TEffect,
  item: Dnd5eAttackingItem | null
): TEffect {
  if (!effect.entries.some((entry) => 'restrictions' in entry && entry.restrictions)) return effect
  const entries = effect.entries.flatMap((entry) => {
    if (!('restrictions' in entry) || !entry.restrictions) return [entry]
    const restrictions = reduceRestrictions(entry.restrictions, item)
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
  if (isEnemyNearCondition(condition)) {
    // Without a Scene the check has no answer, so it fails whatever its constraint.
    if (!circumstances.enemyProximity) return false
    const { nearestFeet } = circumstances.enemyProximity
    matches = nearestFeet !== null && nearestFeet <= condition.feet
  } else {
    const { rollMode } = circumstances
    matches =
      condition.rollMode === 'ADVANTAGE' ? rollMode === 'ADVANTAGE' : rollMode !== 'DISADVANTAGE'
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
        if (!isCircumstanceCondition(condition))
          throw new Error('Attack restrictions must be reduced to circumstance checks.')
        return circumstanceMet(condition, circumstances)
      })
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
