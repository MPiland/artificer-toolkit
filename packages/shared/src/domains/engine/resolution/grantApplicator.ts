import type { AssembledCharacterSnapshot } from '../../core/assemblerContract.js'
import type { CompiledClass } from '../../subjects/compilers/class.js'
import type { CompiledFeat } from '../../subjects/compilers/feat.js'
import type { CompiledModifierGrant } from '../../grants/compilers/modifier.js'
import type { CompiledProficiencyGrant } from '../../grants/compilers/proficiency.js'
import type { CompiledSenseGrant } from '../../grants/compilers/sense.js'
import type { EngineProficiency, EngineSense } from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterAssemblyRegistry } from '../registry.js'

/**
 * Accumulated state built up by processing all features in source order,
 * applying grants within each feature in grant application order.
 */
export interface EngineAccumulatedState {
  proficiencies: EngineProficiency[]
  senses: EngineSense[]
  /**
   * Flat modifier grants collected from all sources.
   * Key: `${valueDomainCode}:${modifierKind}` for grouping by the resolver.
   */
  modifierEntries: Array<{ domainKey: string, modifierKind: string, grant: CompiledModifierGrant }>
  unlockedFeatIds: string[]
  unlockedSpellIds: string[]
}

/* ──────────────────────────────────────────────
 * Proficiency extraction helpers
 * ────────────────────────────────────────────── */

function extractProficiencies(grants: CompiledProficiencyGrant[]): EngineProficiency[] {
  const out: EngineProficiency[] = []

  for (const grant of grants) {
    const scaling = grantScaling(grant)

    // Only GRANTED mode has concrete pre-selected IDs at this point.
    // CHOSEN mode requires player selection stored in featureAcquisitions.selections —
    // those are surfaced via the assembled features, not here.
    const mode = (grant as { authoringModeKind?: string }).authoringModeKind

    if (mode === 'ALL') {
      // ALL mode: all items of this kind are included (e.g. all saves, all skills)
      // Store as a single entry with subjectId='*' — derived stat calculator handles expansion
      out.push({ kind: grant.proficiencyKind, subjectId: '*', scaling })
      continue
    }

    // SELECTED mode: concrete IDs are present in the payload
    switch (grant.proficiencyKind) {
      case 'SKILL': {
        const g = grant as CompiledProficiencyGrant<'SKILL'> & { skillIds?: string[] }
        for (const id of g.skillIds ?? []) {
          out.push({ kind: 'SKILL', subjectId: id, scaling })
        }
        break
      }
      case 'SAVE_ABILITY': {
        const g = grant as CompiledProficiencyGrant<'SAVE_ABILITY'> & { abilities?: string[] }
        for (const ability of g.abilities ?? []) {
          out.push({ kind: 'SAVE_ABILITY', subjectId: ability, scaling })
        }
        break
      }
      case 'LANGUAGE': {
        const g = grant as CompiledProficiencyGrant<'LANGUAGE'> & { languageIds?: string[] }
        for (const id of g.languageIds ?? []) {
          out.push({ kind: 'LANGUAGE', subjectId: id, scaling })
        }
        break
      }
      case 'EQUIPMENT': {
        const g = grant as CompiledProficiencyGrant<'EQUIPMENT'> & { equipmentIds?: string[] }
        for (const id of g.equipmentIds ?? []) {
          out.push({ kind: 'EQUIPMENT', subjectId: id, scaling })
        }
        break
      }
      case 'EQUIPMENT_PROPERTY': {
        const g = grant as CompiledProficiencyGrant<'EQUIPMENT_PROPERTY'> & { properties?: string[] }
        for (const prop of g.properties ?? []) {
          out.push({ kind: 'EQUIPMENT_PROPERTY', subjectId: prop, scaling })
        }
        break
      }
    }
  }

  return out
}

function grantScaling(grant: CompiledProficiencyGrant): EngineProficiency['scaling'] {
  const g = grant as { level?: string }
  if (g.level === 'DOUBLE') return 'DOUBLE'
  if (g.level === 'HALF') return 'HALF'
  return 'FULL'
}

/* ──────────────────────────────────────────────
 * Sense extraction helpers
 * ────────────────────────────────────────────── */

function extractSenses(grants: CompiledSenseGrant[]): EngineSense[] {
  const out: EngineSense[] = []

  for (const grant of grants) {
    // SCALING.NONE grants: pull senseIds from the payload if present
    const g = grant as { senseIds?: string[], range?: number, scalingKind?: string }
    if (g.senseIds) {
      for (const senseCode of g.senseIds) {
        out.push({ senseCode, range: g.range })
      }
    }
  }

  return out
}

/* ──────────────────────────────────────────────
 * Modifier extraction helpers
 * ────────────────────────────────────────────── */

function collectModifiers(
  grants: CompiledModifierGrant[],
  out: EngineAccumulatedState['modifierEntries']
): void {
  for (const grant of grants) {
    const g = grant as { valueDomainCode?: string, modifierKind?: string }
    const domain = g.valueDomainCode ?? 'UNKNOWN'
    const kind = g.modifierKind ?? 'BONUS'
    out.push({ domainKey: `${domain}:${kind}`, modifierKind: kind, grant })
  }
}

/* ──────────────────────────────────────────────
 * Grant applicator
 * ────────────────────────────────────────────── */

/**
 * Applies all grants from all features in the assembled snapshot, following the
 * RulesSystem's featureSourceOrder and grantApplicationOrder.
 *
 * Rule ordering is defined in `dnd5e2014/RULE_ORDER.md` §1 and §2.
 */
export function applyGrants(
  snapshot: AssembledCharacterSnapshot,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem
): EngineAccumulatedState {
  const acc: EngineAccumulatedState = {
    proficiencies: [],
    senses: [],
    modifierEntries: [],
    unlockedFeatIds: [],
    unlockedSpellIds: []
  }

  // Sort assembled features by source order
  const sourceOrderIndex = new Map<string, number>(
    rules.featureSourceOrder.map((kind: string, i: number) => [kind, i] as [string, number])
  )
  const sortedFeatures = [...snapshot.features].sort((a, b) => {
    const ai = sourceOrderIndex.get(a.source.kind) ?? 999
    const bi = sourceOrderIndex.get(b.source.kind) ?? 999
    return ai - bi
  })

  for (const feature of sortedFeatures) {
    // Apply modifier grants from the feature registry
    const registryFeature = registry.features[feature.featureId]
    if (registryFeature?.modifiers?.length) {
      collectModifiers(registryFeature.modifiers, acc.modifierEntries)
    }

    // Apply grants from classes referenced by this feature's source
    if (feature.source.kind === 'CLASS' || feature.source.kind === 'SUBCLASS') {
      const classId = feature.source.kind === 'CLASS'
        ? (feature.source as { classId: string }).classId
        : (feature.source as { subclassId: string }).subclassId
      const compiledClass = registry.classes[classId]
      if (compiledClass) {
        applyClassGrants(compiledClass, acc, rules)
      }
    }

    // Apply grants from feats referenced by this feature's source
    if (feature.source.kind === 'FEAT') {
      const featId = (feature.source as { featId: string }).featId
      const compiledFeat = registry.feats[featId]
      if (compiledFeat) {
        for (const grantKind of rules.grantApplicationOrder) {
          switch (grantKind) {
            case 'PROFICIENCY_GRANT':
              if (compiledFeat.proficiencies?.length) {
                acc.proficiencies.push(...extractProficiencies(compiledFeat.proficiencies))
              }
              break
            case 'SENSE_GRANT':
              if (compiledFeat.senses?.length) {
                acc.senses.push(...extractSenses(compiledFeat.senses))
              }
              break
            case 'MODIFIER_GRANT':
              if (compiledFeat.modifiers?.length) {
                collectModifiers(compiledFeat.modifiers, acc.modifierEntries)
              }
              break
          }
        }
      }
    }

    // Equipment feature grants are resolved via FEATURE source kind from equipped items.
    // Equipment modifiers from registry.equipment are applied after equipped item
    // tracking resolves which items are active.
  }

  // Also collect modifier grants already assembled on the snapshot (from feature registry path)
  // These come from resolveCharacterState() — avoid double-counting by only adding them if
  // they are not already captured from the registry.features path above.
  // The snapshot.modifierGrants are authoritative assembled modifiers — include them directly.
  for (const modifierGrant of snapshot.modifierGrants) {
    const g = modifierGrant.grant as { valueDomainCode?: string, modifierKind?: string }
    const domain = g.valueDomainCode ?? 'UNKNOWN'
    const kind = g.modifierKind ?? 'BONUS'
    acc.modifierEntries.push({
      domainKey: `${domain}:${kind}`,
      modifierKind: kind,
      grant: modifierGrant.grant
    })
  }

  return acc
}

function applyClassGrants(
  compiledClass: CompiledClass,
  acc: EngineAccumulatedState,
  rules: RulesSystem
): void {
  for (const grantKind of rules.grantApplicationOrder) {
    switch (grantKind) {
      case 'PROFICIENCY_GRANT':
        if (compiledClass.proficiencies?.length) {
          acc.proficiencies.push(...extractProficiencies(compiledClass.proficiencies))
        }
        break
    }
  }
}
