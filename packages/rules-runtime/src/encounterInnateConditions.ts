import { encounterCreatureRuleFactsSnapshotSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { MovementTarget } from './encounterMovementTargets.js'

/**
 * The condition types a holder always has: its global `CONDITION` options its features and active
 * grants add (Invisible Stalker's Invisibility). They are held beside the conditions applied to the
 * holder, never stored with them, so nothing removes or restores them.
 */
export function innateConditionIds(
  modifiers: readonly {
    modifierKind: string
    valueDomainCode: string
    scope: string
    payload?: object | undefined
  }[]
): string[] {
  const held = new Set<string>()
  for (const { modifierKind, valueDomainCode, scope, payload } of modifiers) {
    if (
      modifierKind !== 'ADD_OPTION' ||
      valueDomainCode !== 'CONDITION' ||
      scope !== 'GLOBAL' ||
      !payload ||
      !('conditionTypeId' in payload) ||
      typeof payload.conditionTypeId !== 'string' ||
      payload.conditionTypeId.trim() === ''
    )
      continue
    held.add(payload.conditionTypeId)
  }
  return [...held]
}

/**
 * Every condition the actor holds now: those applied to it plus its innate ones. Rules that read
 * what a condition does (sight, attacks, actions) read this; a state transition (applying or
 * ending a condition, restoring one) reads `state.conditions` alone.
 */
export function heldConditionIds(
  target: Pick<MovementTarget, 'state' | 'innateConditionIds'>
): readonly string[] {
  return target.innateConditionIds.length
    ? [...new Set([...target.state.conditions, ...target.innateConditionIds])]
    : target.state.conditions
}

/**
 * A Creature's innate conditions as display rows, from its snapshot's pinned rule facts. The row
 * carries `innate` so the GM and players see the condition as part of the Creature, not removable.
 */
export function creatureInnateConditionRows(
  snapshot: unknown
): { conditionTypeId: string; innate: true }[] {
  const facts = encounterCreatureRuleFactsSnapshotSchema.safeParse(
    typeof snapshot === 'object' && snapshot !== null
      ? (snapshot as { ruleFacts?: unknown }).ruleFacts
      : undefined
  )
  return facts.success
    ? innateConditionIds(facts.data.modifiers).map((conditionTypeId) => ({
        conditionTypeId,
        innate: true as const
      }))
    : []
}
