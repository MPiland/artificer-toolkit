import type { EngineDerivedStats, EngineProficiency } from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CompiledEquipment } from '../../subjects/compilers/equipment.js'

/**
 * Computes all derived stats from the character build snapshot and resolved modifiers.
 *
 * Calculation precedence follows `dnd5e2014/RULE_ORDER.md` §4.
 */
export function calculateDerivedStats(
  snapshot: CharacterBuildSnapshot,
  resolvedModifiers: Record<string, number>,
  proficiencies: EngineProficiency[],
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem
): EngineDerivedStats {
  // Step 1: Base ability scores from snapshot assignments
  const abilityScores: Record<string, number> = { ...snapshot.abilities }

  // Step 2: Apply ABILITY_SCORE domain modifier grants on top
  for (const [key, value] of Object.entries(resolvedModifiers)) {
    const parts = key.split(':')
    const domain = parts[0]
    const ability = parts[2]
    if (domain === 'ABILITY_SCORE' && ability) {
      abilityScores[ability] = (abilityScores[ability] ?? 10) + value
    }
  }

  // Step 3: Ability modifiers
  const abilityModifiers: Record<string, number> = {}
  for (const [ability, score] of Object.entries(abilityScores)) {
    abilityModifiers[ability] = rules.abilityModifier(score)
  }

  // Step 4: Proficiency bonus
  const proficiencyBonus = rules.proficiencyBonus(Math.max(snapshot.totalLevel, 1))

  // Build a proficiency lookup for quick access
  // key: `${kind}:${subjectId}` → scaling
  const proficiencyMap = new Map<string, EngineProficiency['scaling']>()
  for (const prof of proficiencies) {
    proficiencyMap.set(`${prof.kind}:${prof.subjectId}`, prof.scaling)
    if (prof.subjectId === '*') {
      proficiencyMap.set(`${prof.kind}:*`, prof.scaling)
    }
  }

  // Helper: get proficiency multiplier for a kind+subjectId
  function profMultiplier(kind: string, subjectId: string): number {
    const exact = proficiencyMap.get(`${kind}:${subjectId}`)
    const all = proficiencyMap.get(`${kind}:*`)
    const scaling = exact ?? all
    if (!scaling) return 0
    if (scaling === 'FULL') return 1
    if (scaling === 'HALF') return 0.5
    if (scaling === 'DOUBLE') return 2
    return 0
  }

  // Step 5: Saving throws — per ability
  const savingThrows: Record<string, number> = {}
  for (const ability of Object.keys(abilityModifiers)) {
    const mod = abilityModifiers[ability] ?? 0
    const mult = profMultiplier('SAVE_ABILITY', ability)
    savingThrows[ability] = mod + Math.floor(proficiencyBonus * mult)
  }

  // Step 6: Skill bonuses — canonical D&D 5e 2014 skill → governing ability mapping
  const skillBonuses: Record<string, number> = {}
  for (const [skillId, governingAbility] of Object.entries(SKILL_ABILITY_MAP)) {
    const mod = abilityModifiers[governingAbility] ?? 0
    const mult = profMultiplier('SKILL', skillId)
    skillBonuses[skillId] = mod + Math.floor(proficiencyBonus * mult)
  }

  // Step 7: Max HP — sum of per-level values stored on the snapshot
  const maxHitPoints = snapshot.hitpoints.reduce((sum, entry) => sum + entry.value, 0)

  // Step 8: Armor Class
  // Resolution order:
  //   a) If an ARMOR-category item is equipped → use its armorClass + DEX cap per armor weight
  //   b) If a SHIELD is equipped → add its armorClass (usually +2) regardless of armor
  //   c) Apply ARMOR_CLASS:BONUS domain modifiers (spells, features, etc.)
  //   d) Fallback: 10 + DEX modifier (unarmored)
  const armorClass = resolveArmorClass(snapshot, abilityModifiers, resolvedModifiers)

  // Step 9: Initiative — DEX modifier + INITIATIVE_BONUS domain modifiers
  const initiativeBonus = resolvedModifiers['INITIATIVE_BONUS:BONUS'] ?? 0
  const initiative = (abilityModifiers['DEX'] ?? 0) + initiativeBonus

  // Steps 10-11: Spell stats — present only if a spellcasting class is in the registry
  let spellSaveDC: number | undefined
  let spellAttackBonus: number | undefined

  const spellcastingAbility = resolveSpellcastingAbility(snapshot, registry)
  if (spellcastingAbility) {
    const spellMod = abilityModifiers[spellcastingAbility] ?? 0
    spellSaveDC = 8 + proficiencyBonus + spellMod
    spellAttackBonus = proficiencyBonus + spellMod
  }

  return {
    proficiencyBonus,
    abilityScores,
    abilityModifiers,
    savingThrows,
    skillBonuses,
    initiative,
    armorClass,
    maxHitPoints,
    spellSaveDC,
    spellAttackBonus
  }
}

/* ──────────────────────────────────────────────
 * Armor class resolution
 * ────────────────────────────────────────────── */

/**
 * Resolves armor class from equipped items.
 *
 * Armor type (LIGHT / MEDIUM / HEAVY) is determined by the item's `properties` array.
 * DEX contribution per armor type:
 *   - LIGHT: full DEX modifier
 *   - MEDIUM: DEX modifier capped at +2
 *   - HEAVY: no DEX modifier
 *   - Unarmored (no armor equipped): full DEX modifier
 *
 * Shields contribute their `armorClass` value (typically +2) regardless of worn armor.
 * ARMOR_CLASS:BONUS modifiers are always added on top.
 */
function resolveArmorClass(
  snapshot: CharacterBuildSnapshot,
  abilityModifiers: Record<string, number>,
  resolvedModifiers: Record<string, number>
): number {
  const dex = abilityModifiers['DEX'] ?? 0

  let baseAC: number | undefined
  let shieldBonus = 0

  for (const item of snapshot.equippedItems) {
    const compiled = item.compiledItem
    // Variants don't have their own category — skip
    if (compiled.category === 'VARIANT') continue

    const equipment = compiled as CompiledEquipment

    if (equipment.category === 'ARMOR') {
      const ac = equipment.armorClass ?? 10
      const props = equipment.properties

      if (props.includes('HEAVY')) {
        // Heavy armor: fixed AC, no DEX
        baseAC = ac
      } else if (props.includes('MEDIUM')) {
        // Medium armor: base AC + DEX (max +2)
        baseAC = ac + Math.min(dex, 2)
      } else {
        // Light armor (or unclassified armor): base AC + full DEX
        baseAC = ac + dex
      }
    }

    if (equipment.category === 'SHIELD') {
      shieldBonus = equipment.armorClass ?? 2
    }
  }

  // Fall back to unarmored: 10 + DEX
  const armorBase = baseAC ?? (10 + dex)

  // Add shield and any bonus modifiers
  const acBonus = resolvedModifiers['ARMOR_CLASS:BONUS'] ?? 0
  return armorBase + shieldBonus + acBonus
}

/* ──────────────────────────────────────────────
 * Spellcasting ability resolution
 * ────────────────────────────────────────────── */

function resolveSpellcastingAbility(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): string | undefined {
  for (const cls of snapshot.classes) {
    const compiledClass = registry.classes[cls.classId]
    if (compiledClass?.spellcasting?.ability) {
      return compiledClass.spellcasting.ability
    }
  }
  return undefined
}

/* ──────────────────────────────────────────────
 * Canonical D&D 5e 2014 skill → governing ability mapping
 * ────────────────────────────────────────────── */

const SKILL_ABILITY_MAP: Record<string, string> = {
  'acrobatics': 'DEX',
  'animal-handling': 'WIS',
  'arcana': 'INT',
  'athletics': 'STR',
  'deception': 'CHA',
  'history': 'INT',
  'insight': 'WIS',
  'intimidation': 'CHA',
  'investigation': 'INT',
  'medicine': 'WIS',
  'nature': 'INT',
  'perception': 'WIS',
  'performance': 'CHA',
  'persuasion': 'CHA',
  'religion': 'INT',
  'sleight-of-hand': 'DEX',
  'stealth': 'DEX',
  'survival': 'WIS'
}
