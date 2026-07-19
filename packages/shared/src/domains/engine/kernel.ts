import type { EngineCharacterOutput, EngineItemContribution } from './contracts/engineState.js'
import type { RulesSystem } from './contracts/rulesSystem.js'
import type { CharacterAssemblyRegistry } from './registry.js'
import type { CharacterBuildSnapshot } from './snapshot.js'
import { applyGrants } from './resolution/grantApplicator.js'
import type { CompiledModifierGrant } from '../grants/compilers/modifier.js'
import { resolveSpellGrantState } from './resolution/spellGrantResolver.js'
import { resolveModifiers } from './resolution/modifierResolver.js'
import { calculateDerivedStats } from './resolution/derivedStatCalculator.js'
import { resolveSpellSlots } from './resolution/spellSlotResolver.js'
import { resolveResources } from './resolution/resourceResolver.js'
import { buildModifierDomainKey } from './resolution/modifierDomainKey.js'
import { evaluateCharacterFacet } from './prerequisiteEval.js'

/**
 * Resolves a character build snapshot into derived statistics.
 *
 * The engine is pure and deterministic:
 * - no persistence calls
 * - no side effects
 * - identical inputs always produce identical outputs
 *
 * The RulesSystem parameter makes this system-agnostic. Pass `dnd5e2014RulesSystem`
 * for D&D 5e 2014 SRD behaviour. Future systems implement the same interface.
 *
 * Resolution order follows the active RulesSystem's ordering contracts.
 * For dnd5e2014, see `packages/shared/src/domains/engine/dnd5e2014/RULE_ORDER.md`.
 */
export function runEngine(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem
): EngineCharacterOutput {
  const resolvedSpellGrantState = resolveSpellGrantState(snapshot, registry)
  const accumulated = applyGrants(snapshot, registry, rules, resolvedSpellGrantState.spellAccess)
  collectEquipmentItemModifiers(snapshot, registry, accumulated)
  const resolvedModifiers = resolveModifiers(accumulated.modifierEntries, rules, {
    snapshot,
    proficiencies: accumulated.proficiencies
  })
  const activeEquipmentInstanceIds = new Set(accumulated.activeEquipmentInstanceIds)
  const derivedStats = calculateDerivedStats(
    snapshot,
    resolvedModifiers,
    accumulated.proficiencies,
    registry,
    rules,
    activeEquipmentInstanceIds
  )

  const spellSlots = resolveSpellSlots(snapshot, registry)
  const resources = resolveResources(snapshot, registry, rules, accumulated.modifierEntries)
  const activeItemContributions = buildItemContributions(
    snapshot,
    resolvedModifiers,
    registry,
    accumulated
  )

  return {
    characterId: snapshot.characterId,
    systemId: snapshot.systemId,
    proficiencies: accumulated.proficiencies,
    senses: accumulated.senses,
    defenses: resolveDefenses(accumulated.modifierEntries),
    derivedStats,
    spellState: resolvedSpellGrantState.spellState,
    spellSlots,
    resources,
    activeItemContributions
  }
}

function resolveDefenses(
  modifierEntries: ReturnType<typeof applyGrants>['modifierEntries']
): EngineCharacterOutput['defenses'] {
  const domains = {
    DAMAGE_RESISTANCE: 'RESISTANCE',
    DAMAGE_IMMUNITY: 'IMMUNITY',
    DAMAGE_VULNERABILITY: 'VULNERABILITY'
  } as const
  const resolved = new Map<string, EngineCharacterOutput['defenses'][number]>()

  for (const entry of modifierEntries) {
    const grant = entry.grant as {
      valueDomainCode?: keyof typeof domains
      modifierKind?: string
      payload?: { damageTypeId?: string }
    }
    const kind = grant.valueDomainCode ? domains[grant.valueDomainCode] : undefined
    const damageTypeId = grant.payload?.damageTypeId
    if (!kind || !damageTypeId) continue

    const key = `${kind}:${damageTypeId}`
    if (grant.modifierKind === 'REMOVE_OPTION') resolved.delete(key)
    if (grant.modifierKind === 'ADD_OPTION') resolved.set(key, { kind, damageTypeId })
  }

  return [...resolved.values()]
}

function collectEquipmentItemModifiers(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry,
  accumulated: ReturnType<typeof applyGrants>
): void {
  for (const item of snapshot.equipmentItems) {
    if (!accumulated.activeEquipmentInstanceIds.includes(item.instanceId)) continue
    const modifiers = item.compiledItem.modifiers ?? []

    for (const grant of modifiers) {
      if (!isEquipmentItemModifierEligible(grant, item, snapshot, registry, accumulated)) continue

      accumulated.modifierEntries.push({
        domainKey: buildModifierDomainKey(grant.valueDomainCode, grant.modifierKind, grant.domain),
        modifierKind: grant.modifierKind,
        grant
      })
    }
  }
}

function isEquipmentItemModifierEligible(
  grant: CompiledModifierGrant,
  item: CharacterBuildSnapshot['equipmentItems'][number],
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry,
  accumulated: ReturnType<typeof applyGrants>
): boolean {
  if (!grant.restrictions) return true

  const optionIds = snapshot.features.flatMap((feature) =>
    (feature.selections ?? []).flatMap((selection) =>
      selection.values.flatMap((value) =>
        value.kind === 'ID' ? [value.id] : value.kind === 'IDS' ? value.ids : []
      )
    )
  )
  const featIds = snapshot.features.flatMap((feature) => {
    if (feature.source.kind !== 'FEAT') return []
    const featId = feature.source.featId
    return typeof featId === 'string' ? [featId] : []
  })

  return evaluateCharacterFacet(
    grant.restrictions,
    {
      systemId: snapshot.systemId,
      raceId: snapshot.raceId,
      subraceId: snapshot.subraceId,
      classes: snapshot.classes.map((entry) => ({
        classId: entry.classId,
        level: entry.level
      })),
      abilityScores: snapshot.abilities,
      featIds: [...featIds, ...accumulated.unlockedFeatIds],
      spellIds: accumulated.unlockedSpellIds,
      featureIds: snapshot.features.map((feature) => feature.featureId),
      optionIds,
      proficiencies: accumulated.proficiencies,
      equipment: snapshot.equipmentItems.map((equipmentItem) => ({
        equipmentId: equipmentItem.contentRef.definitionId,
        category: equipmentItem.compiledItem.category,
        properties: equipmentItem.compiledItem.properties,
        equipped: Boolean(equipmentItem.equippedState),
        attuned: equipmentItem.attuned
      })),
      sourceState: {
        carried: true,
        equipped: Boolean(item.equippedState),
        attuned: item.attuned
      }
    },
    registry
  ).passed
}

/* ──────────────────────────────────────────────
 * Item contribution provenance
 * ────────────────────────────────────────────── */

/**
 * Tracks which equipped items contributed to derived stat resolution.
 * Currently tracks ARMOR and SHIELD items that affected armorClass.
 */
function buildItemContributions(
  snapshot: CharacterBuildSnapshot,
  resolvedModifiers: Record<string, number>,
  registry: CharacterAssemblyRegistry,
  accumulated: ReturnType<typeof applyGrants>
): EngineItemContribution[] {
  const contributions: EngineItemContribution[] = []

  for (const item of snapshot.equipmentItems) {
    if (!item.equippedState) continue
    if (!accumulated.activeEquipmentInstanceIds.includes(item.instanceId)) continue
    const compiled = item.compiledItem
    if (compiled.category === 'VARIANT') continue

    const modifiersApplied: string[] = []

    if (compiled.category === 'ARMOR' || compiled.category === 'SHIELD') {
      modifiersApplied.push('ARMOR_CLASS')
    }

    // Items with compiled modifiers — track which domain keys they contributed
    if (compiled.modifiers?.length) {
      for (const mod of compiled.modifiers) {
        if (!isEquipmentItemModifierEligible(mod, item, snapshot, registry, accumulated)) continue
        const g = mod as {
          valueDomainCode?: string
          modifierKind?: string
          domain?: Record<string, unknown>
        }
        const key = buildModifierDomainKey(
          g.valueDomainCode ?? 'UNKNOWN',
          g.modifierKind ?? 'BONUS',
          g.domain
        )
        if (resolvedModifiers[key] !== undefined && !modifiersApplied.includes(key)) {
          modifiersApplied.push(key)
        }
      }
    }

    if (modifiersApplied.length > 0) {
      contributions.push({
        instanceId: item.instanceId,
        contentRef: item.contentRef,
        modifiersApplied
      })
    }
  }

  return contributions
}
