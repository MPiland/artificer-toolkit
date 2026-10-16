import type { FacetAuthored } from '@artificer-toolkit/shared/authored'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

import { normalizeCharacterGrantRestrictions } from '../../character/characterGrantFoldRestrictionFacts.js'
import { dnd5eItemRequirementsMet, type Dnd5eAttackingItem } from './modifierApplicability.js'

export type Dnd5eAttackRollMode = 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'

type Restrictions = FacetAuthored
type Group = Restrictions['groups'][number]
type Context = Group['contexts'][number]
type Condition = NonNullable<Context['conditions']>[number]
type RollModeCondition = Extract<Condition, { predicateCode: 'ATTACK_ROLL_MODE' }>
type CreatureTypeCondition = Extract<Condition, { predicateCode: 'CREATURE_TYPE' }>

function isRollModeCondition(condition: Condition): condition is RollModeCondition {
  return condition.kind === 'PREDICATE' && condition.predicateCode === 'ATTACK_ROLL_MODE'
}

function isCreatureTypeCondition(condition: Condition): condition is CreatureTypeCondition {
  return condition.kind === 'PREDICATE' && condition.predicateCode === 'CREATURE_TYPE'
}

/** A check an attack decides only once it rolls: its net roll mode, or the type of its target. */
function isRollTimeCondition(context: Context, condition: Condition): boolean {
  return (
    isRollModeCondition(condition) ||
    (context.subject === 'CREATURE' && isCreatureTypeCondition(condition))
  )
}

/** The context without its roll-time checks; a target context left with none no longer constrains the weapon. */
function withoutRollTimeConditions(context: Context): Context | null {
  const { conditions, ...rest } = context
  const kept = (conditions ?? []).filter((condition) => !isRollTimeCondition(context, condition))
  if (kept.length === 0 && context.subject === 'CREATURE') return null
  return (kept.length > 0 ? { ...rest, conditions: kept } : rest) as Context
}

/** A group's roll-time checks, the only ones an attack decides at the moment it rolls. */
function rollTimeContexts(group: Group): Context[] {
  return group.contexts.flatMap((context) => {
    const conditions = (context.conditions ?? []).filter((condition) =>
      isRollTimeCondition(context, condition)
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
 * Resolves the weapon checks of an attack's restrictions against the weapon it is made with,
 * leaving only the roll-time checks (roll mode, target creature type), which are decided when the
 * attack rolls. A group whose weapon checks fail can never hold and is dropped; a group with
 * nothing left to decide always holds, as does a facet without groups. Returns `null` when the
 * restrictions can never be met and `undefined` when they always are. Only the attacking item's own checks are evaluated: a check the item cannot
 * answer (`ATTACK_ABILITY`, another subject's check) fails its group whatever its constraint.
 */
function reduceRestrictions(
  restrictions: Restrictions,
  item: Dnd5eAttackingItem | null
): Restrictions | null | undefined {
  if (restrictions.groups.length === 0) return undefined
  const groups: Group[] = []
  for (const group of restrictions.groups) {
    const weaponContexts = group.contexts.flatMap(
      (context) => withoutRollTimeConditions(context) ?? []
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
    if (conditions.length > 0 && !dnd5eItemRequirementsMet(weaponChecks, item, null)) continue
    const contexts = rollTimeContexts(group)
    if (contexts.length === 0) return undefined
    groups.push({ ...group, contexts })
  }
  return groups.length === 0 ? null : { ...restrictions, groups }
}

/**
 * Settles every path restriction of a compiled attack Effect against the weapon it is made with,
 * so only the roll-mode checks remain for {@link attackRestrictionsMet}. An entry that can never
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

function rollModeMet(condition: RollModeCondition, rollMode: Dnd5eAttackRollMode): boolean {
  const matches =
    condition.rollMode === 'ADVANTAGE' ? rollMode === 'ADVANTAGE' : rollMode !== 'DISADVANTAGE'
  return condition.constraint === 'INCLUDE' ? matches : !matches
}

function creatureTypeMet(
  condition: CreatureTypeCondition,
  targetCreatureTypeId: string | null
): boolean {
  const matches =
    condition.authoringModeKind === 'ALL' ||
    (targetCreatureTypeId !== null && condition.creatureTypeIds.includes(targetCreatureTypeId))
  return condition.constraint === 'INCLUDE' ? matches : !matches
}

/**
 * Whether reduced restrictions hold for an attack with the given net roll mode and target creature
 * type (null for a target with none, such as a Character): any group, with all of its checks.
 */
export function attackRestrictionsMet(
  restrictions: Restrictions,
  rollMode: Dnd5eAttackRollMode,
  targetCreatureTypeId: string | null = null
): boolean {
  return restrictions.groups.some((group) =>
    group.contexts.every((context) =>
      (context.conditions ?? []).every((condition) => {
        if (isRollModeCondition(condition)) return rollModeMet(condition, rollMode)
        if (isCreatureTypeCondition(condition))
          return creatureTypeMet(condition, targetCreatureTypeId)
        throw new Error('Attack restrictions must be reduced to roll-time checks.')
      })
    )
  )
}
