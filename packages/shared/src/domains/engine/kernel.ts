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
  // Grant accumulation uses the AssembledCharacterSnapshot shape via an adapter.
  const snapshotAsAssembled = adaptSnapshotForGrantApplicator(snapshot, resolvedSpellGrantState.spellAccess)
  const accumulated = applyGrants(snapshotAsAssembled, registry, rules)
  collectEquippedItemModifiers(snapshot, accumulated)
  const resolvedModifiers = resolveModifiers(accumulated.modifierEntries, rules, {
    snapshot,
    proficiencies: accumulated.proficiencies
  })
  const derivedStats = calculateDerivedStats(snapshot, resolvedModifiers, accumulated.proficiencies, registry, rules)

  const spellSlots = resolveSpellSlots(snapshot, registry)
  const resources = resolveResources(snapshot, registry, rules, accumulated.modifierEntries)
  const activeItemContributions = buildItemContributions(snapshot, resolvedModifiers)

  return {
    characterId: snapshot.characterId,
    systemId: snapshot.systemId,
    proficiencies: accumulated.proficiencies,
    senses: accumulated.senses,
    derivedStats,
    spellState: resolvedSpellGrantState.spellState,
    spellSlots,
    resources,
    activeItemContributions
  }
}

function collectEquippedItemModifiers(
  snapshot: CharacterBuildSnapshot,
  accumulated: ReturnType<typeof applyGrants>
): void {
  const proficiencyKeys = new Set(
    accumulated.proficiencies.map((prof) => `${prof.kind}:${prof.subjectId}`)
  )

  for (const item of snapshot.equippedItems) {
    const modifiers = item.compiledItem.modifiers ?? []

    for (const grant of modifiers) {
      if (!isEquippedItemModifierEligible(grant, proficiencyKeys)) continue

      accumulated.modifierEntries.push({
        domainKey: buildModifierDomainKey(grant.valueDomainCode, grant.modifierKind, grant.domain),
        modifierKind: grant.modifierKind,
        grant
      })
    }
  }
}

function isEquippedItemModifierEligible(
  grant: CompiledModifierGrant,
  proficiencyKeys: Set<string>
): boolean {
  const restrictions = (grant as { restrictions?: unknown }).restrictions as
    | {
        groups?: Array<{
          contexts?: Array<{
            subject?: string
            conditions?: Array<{
              predicateCode?: string
              properties?: string[]
              equipmentIds?: string[]
            }>
          }>
        }>
      }
    | undefined

  if (!restrictions?.groups?.length) return true

  for (const group of restrictions.groups) {
    for (const ctx of group.contexts ?? []) {
      if (ctx.subject !== 'CHARACTER') continue

      for (const condition of ctx.conditions ?? []) {
        switch (condition.predicateCode) {
          case 'WHILE_SOURCE_EQUIPPED':
            break
          case 'EQUIPMENT_PROPERTY_PROFICIENCY':
            if ((condition.properties ?? []).some((property) => !proficiencyKeys.has(`EQUIPMENT_PROPERTY:${property}`))) {
              return false
            }
            break
          case 'EQUIPMENT_PROFICIENCY':
            if ((condition.equipmentIds ?? []).some((equipmentId) => !proficiencyKeys.has(`EQUIPMENT:${equipmentId}`))) {
              return false
            }
            break
          default:
            break
        }
      }
    }
  }

  return true
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
  resolvedModifiers: Record<string, number>
): EngineItemContribution[] {
  const contributions: EngineItemContribution[] = []

  for (const item of snapshot.equippedItems) {
    const compiled = item.compiledItem
    if (compiled.category === 'VARIANT') continue

    const modifiersApplied: string[] = []

    if (compiled.category === 'ARMOR' || compiled.category === 'SHIELD') {
      modifiersApplied.push('ARMOR_CLASS')
    }

    // Items with compiled modifiers — track which domain keys they contributed
    if (compiled.modifiers?.length) {
      for (const mod of compiled.modifiers) {
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
        contentId: item.contentRef.contentId,
        modifiersApplied
      })
    }
  }

  return contributions
}

/* ──────────────────────────────────────────────
 * AssembledCharacterSnapshot adapter
 * ────────────────────────────────────────────── */

/**
 * Adapts a CharacterBuildSnapshot into the minimal shape that applyGrants expects.
 *
 * applyGrants currently operates on AssembledCharacterSnapshot — this bridge
 * maps the new snapshot shape to the assembled shape. Once grantApplicator is
 * updated to accept CharacterBuildSnapshot directly this adapter will be removed.
 */
function adaptSnapshotForGrantApplicator(
  snapshot: CharacterBuildSnapshot,
  spellAccess: ReturnType<typeof resolveSpellGrantState>['spellAccess']
) {
  return {
    characterId: snapshot.characterId,
    systemId: snapshot.systemId,
    userId: '',
    label: '',
    features: snapshot.features.map((f) => ({
      id: '',
      featureId: f.featureId,
      source: f.source,
      timing: f.timing
    })),
    modifierGrants: [],
    resources: [],
    spellAccess,
    intent: {
      advancement: { method: 'MILESTONE' as const },
      race: { raceId: '' },
      background: { backgroundId: '' },
      classes: snapshot.classes.map((c) => ({ classId: c.classId, classLevel: c.level })),
      abilities: {
        method: 'STANDARD_ARRAY' as const,
        assignments: Object.entries(snapshot.abilities).map(([ability, score]) => ({
          ability,
          option: String(score) as never
        }))
      },
      hitpoints: {
        method: 'FIXED' as const,
        levels: snapshot.hitpoints.map((h) => ({ level: h.classLevel, value: h.value }))
      },
      featureAcquisitions: []
    },
    state: {
      equipment: { items: [] },
      currency: [],
      hitpoints: { current: 0, temporary: 0 }
    }
  } as never
}
