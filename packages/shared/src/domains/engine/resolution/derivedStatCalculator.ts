import type { EngineDerivedStats, EngineProficiency } from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CompiledEquipment } from '../../subjects/compilers/equipment.js'
import { ABILITIES } from '../../core/ability.js'
import { resolveAbilityRecordKey } from './abilityKey.js'
import { parseModifierDomainKey } from './modifierDomainKey.js'
import { SKILL_ABILITY_MAP } from './skillAbilityMap.js'

const ABILITY_CANONICAL_BY_ALIAS = (() => {
  const map = new Map<string, string>()
  for (const abilityCode of Object.keys(ABILITIES)) {
    map.set(abilityCode, abilityCode)
    const short = ABILITIES[abilityCode as keyof typeof ABILITIES].short
    if (short) map.set(short, abilityCode)
  }
  return map
})()

function toSkillCanonicalId(value: string | undefined): string {
  if (!value) return ''
  return value.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-')
}

export function resolveAbilityAlias(subjectId: string): string | undefined {
  return (
    ABILITY_CANONICAL_BY_ALIAS.get(subjectId) ??
    ABILITY_CANONICAL_BY_ALIAS.get(subjectId.toUpperCase())
  )
}

export function resolveSkillAlias(subjectId: string, skillAliases: Map<string, string>): string {
  if (skillAliases.has(subjectId)) return skillAliases.get(subjectId) ?? subjectId
  const lower = subjectId.toLowerCase()
  if (skillAliases.has(lower)) return skillAliases.get(lower) ?? subjectId

  const normalized = toSkillCanonicalId(subjectId)
  if (skillAliases.has(normalized)) return skillAliases.get(normalized) ?? subjectId
  if (skillAliases.has(normalized.toUpperCase()))
    return skillAliases.get(normalized.toUpperCase()) ?? subjectId

  return subjectId
}

export function buildSkillSubjectAliasMap(
  registry: CharacterAssemblyRegistry
): Map<string, string> {
  const aliases = new Map<string, string>()

  for (const canonical of Object.keys(SKILL_ABILITY_MAP)) {
    aliases.set(canonical, canonical)
    aliases.set(canonical.toUpperCase(), canonical)
  }

  for (const skill of registry.system?.skills ?? []) {
    const canonicalByCode = toSkillCanonicalId(skill.code)
    const canonical =
      SKILL_ABILITY_MAP[canonicalByCode] !== undefined
        ? canonicalByCode
        : SKILL_ABILITY_MAP[toSkillCanonicalId(skill.id)] !== undefined
          ? toSkillCanonicalId(skill.id)
          : undefined

    if (!canonical) continue

    aliases.set(skill.id, canonical)
    if (skill.code) {
      aliases.set(skill.code, canonical)
      aliases.set(skill.code.toUpperCase(), canonical)
      aliases.set(canonicalByCode, canonical)
    }
  }

  return aliases
}

function mapProficiencySubject(
  kind: string,
  subjectId: string,
  skillAliases: Map<string, string>
): string {
  if (kind === 'SKILL') return resolveSkillAlias(subjectId, skillAliases)
  if (kind === 'SAVE_ABILITY') return resolveAbilityAlias(subjectId) ?? subjectId
  return subjectId
}

/**
 * Computes all derived stats from the character build snapshot and resolved modifiers.
 *
 * Calculation precedence follows `dnd5e2014/RULE_ORDER.md` \u00a7 4.
 */
export function calculateDerivedStats(
  snapshot: CharacterBuildSnapshot,
  resolvedModifiers: Record<string, number>,
  proficiencies: EngineProficiency[],
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem,
  activeEquipmentInstanceIds?: ReadonlySet<string>
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
  const skillSubjectAliases = buildSkillSubjectAliasMap(registry)

  // Build a proficiency lookup for quick access
  // key: `${kind}:${subjectId}` -> scaling
  const proficiencyMap = new Map<string, EngineProficiency['scaling']>()
  for (const prof of proficiencies) {
    const mappedSubject = mapProficiencySubject(prof.kind, prof.subjectId, skillSubjectAliases)
    proficiencyMap.set(`${prof.kind}:${mappedSubject}`, prof.scaling)
    if (prof.subjectId === '*') {
      proficiencyMap.set(`${prof.kind}:*`, prof.scaling)
    }
  }

  // Helper: get proficiency multiplier for a kind+subjectId
  function profMultiplier(kind: string, subjectId: string): number {
    const mappedSubject = mapProficiencySubject(kind, subjectId, skillSubjectAliases)
    const exact = proficiencyMap.get(`${kind}:${mappedSubject}`)
    const all = proficiencyMap.get(`${kind}:*`)
    const scaling = exact ?? all
    if (!scaling) return 0
    if (scaling === 'FULL') return 1
    if (scaling === 'HALF') return 0.5
    if (scaling === 'DOUBLE') return 2
    return 0
  }

  // Step 5: Saving throws per ability
  const savingThrows: Record<string, number> = {}
  for (const ability of Object.keys(abilityModifiers)) {
    const canonicalAbility = resolveAbilityAlias(ability) ?? ability
    const modifierAbility =
      resolveAbilityRecordKey(abilityModifiers, ability) ??
      resolveAbilityRecordKey(abilityModifiers, canonicalAbility) ??
      ability
    const mod = abilityModifiers[modifierAbility] ?? 0
    const mult = profMultiplier('SAVE_ABILITY', canonicalAbility)
    savingThrows[ability] = mod + Math.floor(proficiencyBonus * mult)
  }

  // Step 6: Skill bonuses - canonical D&D 5e 2014 skill -> governing ability mapping
  const skillBonuses: Record<string, number> = {}
  for (const [skillId, governingAbility] of Object.entries(SKILL_ABILITY_MAP)) {
    const mod =
      abilityModifiers[
        resolveAbilityRecordKey(abilityModifiers, governingAbility) ?? governingAbility
      ] ?? 0
    const mult = profMultiplier('SKILL', skillId)
    skillBonuses[skillId] = mod + Math.floor(proficiencyBonus * mult)
  }
  const skillGoverningAbilities = { ...SKILL_ABILITY_MAP }
  const passiveChecks = Object.fromEntries(
    Object.entries(skillBonuses).map(([skillId, bonus]) => [skillId, rules.passiveScore(bonus)])
  )
  const selectedRaceId = snapshot.subraceId ?? snapshot.raceId
  const movementSpeeds = selectedRaceId
    ? (registry.races[selectedRaceId]?.speeds ?? []).map((speed) => ({ ...speed }))
    : []
  const speedCodes = new Map((registry.system?.speeds ?? []).map((speed) => [speed.id, speed.code]))
  const primaryMovementSpeedId = rules.selectPrimaryMovementSpeedId(
    movementSpeeds.map((speed) => ({
      speedId: speed.speedId,
      code: speedCodes.get(speed.speedId)
    })),
    snapshot.movementDisplayPreference ?? { mode: 'AUTO' }
  )

  // Step 7: Max HP — sum of per-level values stored on the snapshot
  const maxHitPoints = snapshot.hitpoints.reduce((sum, entry) => sum + entry.value, 0)

  // Step 8: Armor Class
  // Resolution order:
  //   a) If an ARMOR-category item is equipped -> use its armorClass + DEX cap per armor weight
  //   b) If a SHIELD is equipped -> add its armorClass (usually +2) regardless of armor
  //   c) Apply ARMOR_CLASS:BONUS domain modifiers (spells, features, etc.)
  //   d) Fallback: 10 + DEX modifier (unarmored)
  const armorClass = resolveArmorClass(
    snapshot,
    abilityModifiers,
    resolvedModifiers,
    activeEquipmentInstanceIds
  )

  // Step 9: Initiative — DEX modifier + INITIATIVE domain modifiers
  const initiativeBonus = resolvedModifiers['INITIATIVE:BONUS'] ?? 0
  const initiative =
    (abilityModifiers[resolveAbilityRecordKey(abilityModifiers, 'DEX') ?? 'DEX'] ?? 0) +
    initiativeBonus

  // Steps 10-11: Spell stats — present only if a spellcasting class is in the registry
  let spellSaveDC: number | undefined
  let spellAttackBonus: number | undefined

  const spellcastingAbility = resolveSpellcastingAbility(snapshot, registry)
  if (spellcastingAbility) {
    const spellMod =
      abilityModifiers[
        resolveAbilityRecordKey(abilityModifiers, spellcastingAbility) ?? spellcastingAbility
      ] ?? 0
    spellSaveDC = 8 + proficiencyBonus + spellMod
    spellAttackBonus = proficiencyBonus + spellMod
  }

  return {
    proficiencyBonus,
    abilityScores,
    abilityModifiers,
    savingThrows,
    skillBonuses,
    skillGoverningAbilities,
    passiveChecks,
    movementSpeeds,
    ...(primaryMovementSpeedId ? { primaryMovementSpeedId } : {}),
    initiative,
    armorClass,
    maxHitPoints,
    spellSaveDC,
    spellAttackBonus
  }
}

/* ---------------------------------------------------------------------------
 * Armor class resolution
 * ------------------------------------------------------------------------- */

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
  resolvedModifiers: Record<string, number>,
  activeEquipmentInstanceIds?: ReadonlySet<string>
): number {
  const dex = abilityModifiers['DEX'] ?? 0

  let baseAC: number | undefined
  let shieldBonus = 0

  for (const item of snapshot.equipmentItems) {
    if (!item.equippedState) continue
    if (activeEquipmentInstanceIds && !activeEquipmentInstanceIds.has(item.instanceId)) continue
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
  const armorBase = baseAC ?? 10 + dex

  // Add shield and any bonus modifiers
  const acBonus = Object.entries(resolvedModifiers)
    .filter(([key]) => parseModifierDomainKey(key).valueDomainCode === 'ARMOR_CLASS')
    .reduce((sum, [, value]) => sum + value, 0)

  return armorBase + shieldBonus + acBonus
}

/* ---------------------------------------------------------------------------
 * Spellcasting ability resolution
 * ------------------------------------------------------------------------- */

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
