import { SCALABLE_SCALING_KIND, SCALING_SOURCE } from '@artificer-toolkit/shared'
import type { ManifestCreatureFormAuthored } from '@artificer-toolkit/shared/authored'
import { spellChildId } from './shared.js'

/**
 * The System Creatures a summon spell offers: one form each, in the order given, with how many of it
 * one cast conjures at the lowest slot (a Conjure spell's challenge rating budget). `multipliers`
 * names the slot levels that conjure more: each multiplies every form's count (Conjure Animals:
 * twice as many with a 5th-level slot).
 */
export function conjuredCreatureForms(
  spellId: string,
  creatures: readonly (readonly [creatureId: string, label: string, count: number])[],
  multipliers: readonly { level: number; multiplier: number }[] = []
): ManifestCreatureFormAuthored[] {
  return creatures.map(([creatureId, label, count], index) => ({
    id: spellChildId(spellId, 0x214, index + 1),
    order: index + 1,
    label,
    creatureId,
    maxTargets: count,
    ...(multipliers.length
      ? {
          maxTargetsScaling: {
            scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
            scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
            breakpoints: multipliers.map(({ level, multiplier }, row) => ({
              id: spellChildId(spellId, 0x216, (index + 1) * 16 + row + 1),
              level,
              order: row + 1,
              value: { amount: count * multiplier }
            }))
          }
        }
      : {})
  }))
}
