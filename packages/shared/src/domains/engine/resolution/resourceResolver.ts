import type { EngineResource } from '../contracts/engineState.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import type { CompiledCharge } from '../../shared/compilers/charge.js'

/**
 * Resolves class resource maximums (Rage, Ki, Channel Divinity, etc.)
 * from the compiled class resource data at the character's current class level.
 *
 * Resources are granted via `CompiledClassResource.charges` on each compiled class.
 * The max count is resolved from the charge's limitKind + scalingKind.
 */
export function resolveResources(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): EngineResource[] {
  const out: EngineResource[] = []

  for (const cls of snapshot.classes) {
    const compiled = registry.classes[cls.classId]
    if (!compiled?.resources) continue

    const resource = compiled.resources
    const maxCount = resolveChargeMax(resource.charges, cls.level, snapshot.totalLevel)
    if (maxCount <= 0) continue

    out.push({
      resourceId: resource.id,
      label: resource.id, // label resolved from authored content — id as fallback
      maxCount,
      rechargeOn: mapResetKind(resource.charges.resetKind),
      sourceFeatureId: cls.classId,
    })
  }

  return out
}

/* ──────────────────────────────────────────────
 * Charge max resolution
 * ────────────────────────────────────────────── */

/**
 * Resolves the maximum charge count from a CompiledCharge at a given class and character level.
 *
 * Handles:
 * - FIXED_AMOUNT + SCALING.NONE: static `amount`
 * - FIXED_AMOUNT + SCALING.PER_LEVEL: look up the closest level entry
 * - CLASS_LEVEL / CHARACTER_LEVEL / PARENT_CLASS_LEVEL: multiply level by multiplier (+ optional min/max)
 */
function resolveChargeMax(charge: CompiledCharge, classLevel: number, totalLevel: number): number {
  if (charge.scalingKind === 'PER_LEVEL') {
    // Find the level entry at or below classLevel
    const sorted = [...charge.levels].sort((a, b) => b.level - a.level)
    const entry = sorted.find((e) => e.level <= classLevel)
    return entry?.amount ?? 0
  }

  // SCALING.NONE variants
  switch (charge.limitKind) {
    case 'FIXED_AMOUNT': {
      return (charge as { amount: number }).amount
    }
    case 'CLASS_LEVEL':
    case 'PARENT_CLASS_LEVEL': {
      const payload = charge as { multiplier?: number; min?: number; max?: number }
      const raw = classLevel * (payload.multiplier ?? 1)
      return clamp(raw, payload.min, payload.max)
    }
    case 'CHARACTER_LEVEL': {
      const payload = charge as { multiplier?: number; min?: number; max?: number }
      const raw = totalLevel * (payload.multiplier ?? 1)
      return clamp(raw, payload.min, payload.max)
    }
    case 'SPELL_CAST_LEVEL': {
      // Not applicable at build time — spell cast level is play-state
      return 0
    }
    default:
      return 0
  }
}

function clamp(value: number, min?: number, max?: number): number {
  let result = value
  if (min !== undefined) result = Math.max(result, min)
  if (max !== undefined) result = Math.min(result, max)
  return Math.floor(result)
}

function mapResetKind(resetKind: string): EngineResource['rechargeOn'] {
  switch (resetKind) {
    case 'SHORT_REST': return 'SHORT_REST'
    case 'LONG_REST': return 'LONG_REST'
    default: return 'MANUAL'
  }
}
