import type { EngineDerivedStats, EngineProficiency } from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CompiledEquipment } from '../../subjects/compilers/equipment.js'
import { resolveAbilityRecordKey } from './abilityKey.js'
import { parseModifierDomainKey } from './modifierDomainKey.js'

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
    const parsed = parseModifierDomainKey(key)
    const ability = resolveAbilityRecordKey(abilityScores, parsed.params.ability)
    if (parsed.valueDomainCode === 'ABILITY_SCORE' && ability) {
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
    const mod = abilityModifiers[resolveAbilityRecordKey(abilityModifiers, governingAbility) ?? governingAbility] ?? 0
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

  // Step 9: Initiative — DEX modifier + INITIATIVE domain modifiers
  const initiativeBonus = resolvedModifiers['INITIATIVE:BONUS'] ?? 0
  const initiative = (abilityModifiers[resolveAbilityRecordKey(abilityModifiers, 'DEX') ?? 'DEX'] ?? 0) + initiativeBonus

  // Steps 10-11: Spell stats — present only if a spellcasting class is in the registry
  let spellSaveDC: number | undefined
  let spellAttackBonus: number | undefined

  const spellcastingAbility = resolveSpellcastingAbility(snapshot, registry)
  if (spellcastingAbility) {
    const spellMod = abilityModifiers[resolveAbilityRecordKey(abilityModifiers, spellcastingAbility) ?? spellcastingAbility] ?? 0
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
 * Armor items contribute their base `armorClass` only.
 * Ability-driven AC changes are authored through modifiers.
 *
 * Shields still contribute their fixed `armorClass` value directly.
 * ARMOR_CLASS numeric modifiers are always added on top.
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
      baseAC = equipment.armorClass ?? 10
    }

    if (equipment.category === 'SHIELD') {
      shieldBonus = equipment.armorClass ?? 2
    }
  }

  // Fall back to unarmored: 10 + DEX
  const armorBase = baseAC ?? (10 + dex)

  // Add shield and any bonus modifiers
  const acBonus = Object.entries(resolvedModifiers)
    .filter(([key]) => parseModifierDomainKey(key).valueDomainCode === 'ARMOR_CLASS')
    .reduce((sum, [, value]) => sum + value, 0)

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

