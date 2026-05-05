import type { EngineResource } from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import { resolveCompiledChargeMaximum } from '../../shared/compilers/charge.js'

/**
 * Resolves class resource maximums from compiled class resource data at the
 * character's current class level.
 */
export function resolveResources(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem
): EngineResource[] {
  const out: EngineResource[] = []
  const proficiencyBonus = rules.proficiencyBonus(Math.max(snapshot.totalLevel, 1))

  for (const cls of snapshot.classes) {
    const compiled = registry.classes[cls.classId]
    if (!compiled?.resources) continue

    const resource = compiled.resources
    const maxCount = resolveCompiledChargeMaximum(resource.charges, {
      abilities: snapshot.abilities,
      classLevel: cls.level,
      proficiencyBonus,
      totalLevel: snapshot.totalLevel
    })
    if (maxCount <= 0) continue

    out.push({
      resourceId: resource.id,
      label: resource.id,
      maxCount,
      rechargeOn: mapResetKind(resource.charges.resetKind),
      sourceFeatureId: cls.classId
    })
  }

  return out
}

function mapResetKind(resetKind: string): EngineResource['rechargeOn'] {
  switch (resetKind) {
    case 'SHORT_REST':
      return 'SHORT_REST'
    case 'LONG_REST':
      return 'LONG_REST'
    default:
      return 'MANUAL'
  }
}
