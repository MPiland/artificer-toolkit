import type { EngineSpellSlots } from '../contracts/engineState.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import { CHARGE_RESET_KIND } from '../../shared/core/charge.js'

/**
 * Resolves spell slot maximums for the character.
 *
 * Single-class: reads directly from the class's compiled `spellLimits` at current level.
 * Multiclass with multiple spellcasters: uses the 5e multiclass fusion table.
 * Pact magic (Warlock): detected via `spellcasting.charges` presence; tracked separately.
 *
 * See: dnd5e2014/RULE_ORDER.md §5 for slot fusion rules.
 */
export function resolveSpellSlots(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): EngineSpellSlots {
  const spellcastingClasses: Array<{
    classId: string
    level: number
    isPactMagic: boolean
    spellLimits: Array<{
      classLevel: number
      slots: Array<{ spellLevel: number; slotCount: number }>
    }>
  }> = []

  for (const cls of snapshot.classes) {
    const compiled = registry.classes[cls.classId]
    if (!compiled?.spellcasting?.spellLimits?.length) continue

    const isPactMagic = compiled.spellcasting.charges?.resetKind === CHARGE_RESET_KIND.SHORT_REST
    spellcastingClasses.push({
      classId: cls.classId,
      level: cls.level,
      isPactMagic,
      spellLimits: compiled.spellcasting.spellLimits
    })
  }

  // No spellcasting at all
  if (spellcastingClasses.length === 0) {
    return { maxByLevel: {}, fusionStrategy: 'NONE' }
  }

  // Separate pact magic from standard spellcasting
  const standardCasters = spellcastingClasses.filter((c) => !c.isPactMagic)
  const pactCasters = spellcastingClasses.filter((c) => c.isPactMagic)

  // Resolve pact magic separately (always from the last pact caster's table)
  let pactMagic: EngineSpellSlots['pactMagic'] | undefined
  for (const pact of pactCasters) {
    const slotsAtLevel = findSpellLimitsAtLevel(pact.spellLimits, pact.level)
    if (slotsAtLevel.length > 0) {
      // Pact magic: all slots are the same level (highest available)
      const highestSlot = slotsAtLevel.reduce((a, b) => (b.spellLevel > a.spellLevel ? b : a))
      pactMagic = { slots: highestSlot.slotCount, level: highestSlot.spellLevel }
    }
  }

  if (standardCasters.length === 0) {
    // Only pact magic — no standard slots
    return { maxByLevel: {}, pactMagic, fusionStrategy: 'NONE' }
  }

  if (standardCasters.length === 1) {
    // Single standard spellcasting class: read slots directly
    const caster = standardCasters[0]!
    const slotsAtLevel = findSpellLimitsAtLevel(caster.spellLimits, caster.level)
    const maxByLevel = slotsToRecord(slotsAtLevel)

    return {
      maxByLevel,
      pactMagic,
      fusionStrategy: 'SINGLE_CLASS'
    }
  }

  // Multiple standard spellcasting classes: fuse using effective caster level
  // Effective caster level is inferred from the number of spell levels in the spellLimits table:
  //   - 9 spell levels available → FULL caster (use class level directly)
  //   - 5 spell levels available → HALF caster (use floor(classLevel / 2))
  //   - 4 or fewer spell levels → THIRD caster (use floor(classLevel / 3))
  let totalEffectiveCasterLevel = 0
  for (const caster of standardCasters) {
    const maxSpellLevelGranted = getMaxSpellLevel(caster.spellLimits)
    const effectiveLevel = getEffectiveCasterLevel(caster.level, maxSpellLevelGranted)
    totalEffectiveCasterLevel += effectiveLevel
  }

  const maxByLevel = lookupMulticlassSlotTable(Math.min(totalEffectiveCasterLevel, 20))

  return {
    maxByLevel,
    pactMagic,
    fusionStrategy: 'MULTICLASS_FUSED'
  }
}

/* ──────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────── */

function findSpellLimitsAtLevel(
  spellLimits: Array<{
    classLevel: number
    slots: Array<{ spellLevel: number; slotCount: number }>
  }>,
  classLevel: number
): Array<{ spellLevel: number; slotCount: number }> {
  // Find the entry at or below classLevel (highest matching)
  const entry = [...spellLimits]
    .filter((e) => e.classLevel <= classLevel)
    .sort((a, b) => b.classLevel - a.classLevel)[0]

  return entry?.slots ?? []
}

function slotsToRecord(
  slots: Array<{ spellLevel: number; slotCount: number }>
): Record<number, number> {
  const out: Record<number, number> = {}
  for (const s of slots) {
    if (s.slotCount > 0) {
      out[s.spellLevel] = s.slotCount
    }
  }
  return out
}

function getMaxSpellLevel(
  spellLimits: Array<{
    classLevel: number
    slots: Array<{ spellLevel: number; slotCount: number }>
  }>
): number {
  let max = 0
  for (const entry of spellLimits) {
    for (const slot of entry.slots) {
      if (slot.spellLevel > max) max = slot.spellLevel
    }
  }
  return max
}

function getEffectiveCasterLevel(classLevel: number, maxSpellLevel: number): number {
  if (maxSpellLevel >= 9) {
    // Full caster (Wizard, Cleric, Druid, Bard, Sorcerer)
    return classLevel
  } else if (maxSpellLevel >= 5) {
    // Half caster (Paladin, Ranger)
    return Math.floor(classLevel / 2)
  } else {
    // Third caster (Arcane Trickster, Eldritch Knight)
    return Math.floor(classLevel / 3)
  }
}

/**
 * D&D 5e 2014 multiclass spellcaster combined slot table (DMG p. 165).
 * Keyed by total effective caster level (1–20) → slot level (1–9) → count.
 */
function lookupMulticlassSlotTable(effectiveLevel: number): Record<number, number> {
  const table: Record<number, Record<number, number>> = {
    1: { 1: 2 },
    2: { 1: 3 },
    3: { 1: 4, 2: 2 },
    4: { 1: 4, 2: 3 },
    5: { 1: 4, 2: 3, 3: 2 },
    6: { 1: 4, 2: 3, 3: 3 },
    7: { 1: 4, 2: 3, 3: 3, 4: 1 },
    8: { 1: 4, 2: 3, 3: 3, 4: 2 },
    9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
    10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
    11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
    12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
    13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
    14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
    15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
    16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
    17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
    18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
    19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
    20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }
  }

  return table[effectiveLevel] ?? {}
}
