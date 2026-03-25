import type { EngineResource } from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
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
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem
): EngineResource[] {
  const out: EngineResource[] = []
  const proficiencyBonus = rules.proficiencyBonus(Math.max(snapshot.totalLevel, 1))

  for (const cls of snapshot.classes) {
    const compiled = registry.classes[cls.classId]
    if (!compiled?.resources) continue

    const resource = compiled.resources
    const maxCount = resolveChargeMax(resource.charges, cls.level, snapshot.totalLevel, snapshot.abilities, proficiencyBonus)
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
 * - FIXED_AMOUNT + SCALING.NONE: static `amount` (+ bonuses)
 * - FIXED_AMOUNT + SCALING.PER_LEVEL: look up the closest level entry (+ bonuses)
 * - ABILITY_MODIFIER: ability score modifier (+ optional multiplier, min, max)
 * - CLASS_LEVEL / CHARACTER_LEVEL / PARENT_CLASS_LEVEL: multiply level by multiplier (+ optional min/max)
 *
 * Bonuses (ABILITY_MODIFIER, PROFICIENCY_BONUS, SKILL_BONUS) are resolved and added to the base.
 */
function resolveChargeMax(charge: CompiledCharge, classLevel: number, totalLevel: number, abilities: Record<string, number>, proficiencyBonus: number): number {
  let base = 0

  if (charge.scalingKind === 'PER_LEVEL') {
    // Find the level entry at or below classLevel
    const sorted = [...charge.levels].sort((a, b) => b.level - a.level)
    const entry = sorted.find((e) => e.level <= classLevel)
    base = entry?.amount ?? 0
  } else {
    // SCALING.NONE variants
    switch (charge.limitKind) {
      case 'ABILITY_MODIFIER': {
        const payload = charge as { ability: string; multiplier?: number; min?: number; max?: number }
        const score = abilities[payload.ability] ?? 10
        const mod = Math.floor((score - 10) / 2)
        const raw = mod * (payload.multiplier ?? 1)
        return clamp(raw, payload.min, payload.max)
      }
      case 'FIXED_AMOUNT': {
        base = (charge as { amount: number }).amount
        break
      }
      case 'CLASS_LEVEL':
      case 'PARENT_CLASS_LEVEL': {
        const payload = charge as { multiplier?: number; min?: number; max?: number }
        return clamp(classLevel * (payload.multiplier ?? 1), payload.min, payload.max)
      }
      case 'CHARACTER_LEVEL': {
        const payload = charge as { multiplier?: number; min?: number; max?: number }
        return clamp(totalLevel * (payload.multiplier ?? 1), payload.min, payload.max)
      }
      case 'SPELL_CAST_LEVEL': {
        // Not applicable at build time — spell cast level is play-state
        return 0
      }
      default:
        return 0
    }
  }

  // Apply bonuses to base
  if (charge.bonuses && charge.bonuses.length > 0) {
    for (const bonus of charge.bonuses) {
      let bonusValue = 0
      switch (bonus.bonusKind) {
        case 'ABILITY_MODIFIER': {
          const score = abilities[(bonus as { ability: string }).ability] ?? 10
          const mod = Math.floor((score - 10) / 2)
          bonusValue = clamp(mod * (bonus.multiplier ?? 1), bonus.min, bonus.max)
          break
        }
        case 'PROFICIENCY_BONUS': {
          bonusValue = clamp(proficiencyBonus * (bonus.multiplier ?? 1), bonus.min, bonus.max)
          break
        }
        case 'SKILL_BONUS': {
          // Skill bonus resolution requires skill check total — not available here; skip
          break
        }
      }
      base += bonusValue
    }
  }

  return Math.max(0, Math.floor(base))
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
