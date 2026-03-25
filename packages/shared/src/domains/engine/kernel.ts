import type { EngineCharacterOutput, EngineItemContribution } from './contracts/engineState.js'
import type { RulesSystem } from './contracts/rulesSystem.js'
import type { CharacterAssemblyRegistry } from './registry.js'
import type { CharacterBuildSnapshot } from './snapshot.js'
import { applyGrants } from './resolution/grantApplicator.js'
import { resolveSpellGrantState } from './resolution/spellGrantResolver.js'
import { resolveModifiers } from './resolution/modifierResolver.js'
import { calculateDerivedStats } from './resolution/derivedStatCalculator.js'
import { resolveSpellSlots } from './resolution/spellSlotResolver.js'
import { resolveResources } from './resolution/resourceResolver.js'

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
  const resolvedModifiers = resolveModifiers(accumulated.modifierEntries, rules)
  const derivedStats = calculateDerivedStats(snapshot, resolvedModifiers, accumulated.proficiencies, registry, rules)

  const spellSlots = resolveSpellSlots(snapshot, registry)
  const resources = resolveResources(snapshot, registry, rules)
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
        const g = mod as { valueDomainCode?: string, modifierKind?: string }
        const key = `${g.valueDomainCode ?? 'UNKNOWN'}:${g.modifierKind ?? 'BONUS'}`
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
