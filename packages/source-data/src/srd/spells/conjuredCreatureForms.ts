import type { ManifestCreatureFormAuthored } from '@artificer-toolkit/shared/authored'
import { spellChildId } from './shared.js'

/**
 * The System Creatures a multi-creature Conjure spell offers: one form each, in the order given, with
 * how many of it one cast conjures at the lowest slot (the spell's challenge rating budget).
 */
export function conjuredCreatureForms(
  spellId: string,
  creatures: readonly (readonly [creatureId: string, label: string, count: number])[]
): ManifestCreatureFormAuthored[] {
  return creatures.map(([creatureId, label, count], index) => ({
    id: spellChildId(spellId, 0x214, index + 1),
    order: index + 1,
    label,
    creatureId,
    maxTargets: count
  }))
}
