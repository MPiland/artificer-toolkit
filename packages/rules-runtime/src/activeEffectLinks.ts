import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

type LinkedEffect = Pick<ActiveRuleEffectRecord, 'id' | 'definition'>

/**
 * `ended` and every held effect that ends with one of them (D172), transitively, in held order. An
 * effect ends with the effect its definition links to (`linkedEffectId`), so whichever seam ends
 * the first ends the rest in the same transaction and receipt.
 */
export function withLinkedDependents<Effect extends LinkedEffect>(
  ended: readonly Effect[],
  held: readonly Effect[]
): Effect[] {
  if (ended.length === 0) return []
  const endedIds = new Set(ended.map(({ id }) => id))
  let grew = true
  while (grew) {
    grew = false
    for (const { id, definition } of held) {
      if (
        !endedIds.has(id) &&
        definition.linkedEffectId &&
        endedIds.has(definition.linkedEffectId)
      ) {
        endedIds.add(id)
        grew = true
      }
    }
  }
  const heldIds = new Set(held.map(({ id }) => id))
  return [
    ...held.filter(({ id }) => endedIds.has(id)),
    ...ended.filter(({ id }) => !heldIds.has(id))
  ]
}
