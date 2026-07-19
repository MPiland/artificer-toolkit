import type { CharacterBuildSnapshot } from '../snapshot.js'
import type { CompiledClass } from '../../subjects/compilers/class.js'
import type { CompiledModifierGrant } from '../../grants/compilers/modifier.js'
import type { CompiledProficiencyGrant } from '../../grants/compilers/proficiency.js'
import type { CompiledSenseGrant } from '../../grants/compilers/sense.js'
import type { CompiledRange } from '../../shared/compilers/range.js'
import type { EngineProficiency, EngineSense } from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterAssemblyRegistry, CharacterAssemblyRegistryFeature } from '../registry.js'
import {
  getCharacterChosenGrantSelectionIdentityKey,
  type CharacterProvenance
} from '../../subjects/authored/character/intent.js'
import { buildModifierDomainKey } from './modifierDomainKey.js'
import { evaluateCharacterFacet, type CharacterEligibilityContext } from '../prerequisiteEval.js'

const FEATURE_CHOICE_SELECTION_KEY = 'options'

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
   *
   * `scopeSpellIds` is present when the grant's restrictions contain a SPELL-subject
   * context — the modifier only applies when resolving one of those spells.
   * The character sheet uses this to display "applies to: Eldritch Blast" rather
   * than showing the modifier as a global bonus.
   */
  modifierEntries: Array<{
    domainKey: string
    modifierKind: string
    grant: CompiledModifierGrant
    scopeSpellIds?: string[]
  }>
  unlockedFeatIds: string[]
  unlockedSpellIds: string[]
  /** Equipment instances whose root eligibility and attunement requirements passed. */
  activeEquipmentInstanceIds: string[]
}

/* ──────────────────────────────────────────────
 * Proficiency extraction helpers
 * ────────────────────────────────────────────── */

function extractProficiencies(
  grants: CompiledProficiencyGrant[],
  snapshot: CharacterBuildSnapshot,
  ownerSource: CharacterProvenance
): EngineProficiency[] {
  const out: EngineProficiency[] = []

  for (const grant of grants) {
    const scaling = grantScaling(grant)

    if (grant.selectionKind === 'CHOSEN') {
      pushProficiencies(
        out,
        grant,
        getSelectedGrantTargetIds(snapshot, grant.id, ownerSource),
        scaling
      )
      continue
    }

    // Only GRANTED mode has concrete pre-selected IDs at this point.
    // CHOSEN mode requires player selection stored in featureAcquisitions.selections —
    // those are surfaced via the assembled features, not here.
    const mode = (grant as { authoringModeKind?: string }).authoringModeKind

    if (mode === 'ALL') {
      // ALL mode: all items of this kind are included (e.g. all saves, all skills)
      // Store as a single entry with subjectId='*' — derived stat calculator handles expansion
      const category =
        grant.proficiencyKind === 'EQUIPMENT_PROPERTY'
          ? (
              grant as CompiledProficiencyGrant<'EQUIPMENT_PROPERTY'> & {
                category?: EngineProficiency['category']
              }
            ).category
          : undefined
      out.push({
        kind: grant.proficiencyKind,
        subjectId: '*',
        scaling,
        ...(category ? { category } : {})
      })
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
        const g = grant as CompiledProficiencyGrant<'EQUIPMENT_PROPERTY'> & {
          properties?: string[]
          category?: EngineProficiency['category']
        }
        for (const prop of g.properties ?? []) {
          out.push({
            kind: 'EQUIPMENT_PROPERTY',
            subjectId: prop,
            scaling,
            ...(g.category ? { category: g.category } : {})
          })
        }
        break
      }
    }
  }

  return out
}

function pushProficiencies(
  out: EngineProficiency[],
  grant: CompiledProficiencyGrant,
  ids: readonly string[],
  scaling: EngineProficiency['scaling']
): void {
  const category =
    grant.proficiencyKind === 'EQUIPMENT_PROPERTY'
      ? (
          grant as CompiledProficiencyGrant<'EQUIPMENT_PROPERTY'> & {
            category?: EngineProficiency['category']
          }
        ).category
      : undefined
  for (const id of ids) {
    out.push({
      kind: grant.proficiencyKind,
      subjectId: id,
      scaling,
      ...(category ? { category } : {})
    })
  }
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

function extractSenses(
  grants: CompiledSenseGrant[],
  snapshot: CharacterBuildSnapshot,
  activeLevel: number,
  ownerSource: CharacterProvenance
): EngineSense[] {
  const out: EngineSense[] = []

  for (const grant of grants) {
    // SCALING.NONE grants: pull senseIds from the payload if present
    const g = grant as {
      senseIds?: string[]
      range?: CompiledRange
      scalingKind?: string
      selectionKind?: string
      levels?: Array<{ level: number; senseIds?: string[] }>
    }
    if (g.scalingKind === 'PER_LEVEL') {
      for (const level of g.levels ?? []) {
        if (level.level > activeLevel) continue
        const ids =
          g.selectionKind === 'CHOSEN'
            ? getSelectedGrantTargetIds(snapshot, grant.id, ownerSource, level.level)
            : (level.senseIds ?? [])
        for (const senseCode of ids) {
          out.push({ senseCode, range: g.range })
        }
      }
      continue
    }

    const ids =
      g.selectionKind === 'CHOSEN'
        ? getSelectedGrantTargetIds(snapshot, grant.id, ownerSource)
        : (g.senseIds ?? [])
    for (const senseCode of ids) {
      out.push({ senseCode, range: g.range })
    }
  }

  return out
}

/* ──────────────────────────────────────────────
 * Modifier extraction helpers
 * ────────────────────────────────────────────── */

/**
 * Collects modifier grants into the accumulated state, evaluating restrictions:
 *
 * - CHARACTER-subject contexts: gate whether the grant is collected at all.
 *   The shared facet evaluator owns predicate support and fails closed for
 *   predicates that cannot be evaluated from the supplied character context.
 *
 * - Non-CHARACTER subject contexts (e.g. SPELL): tag the entry with scope IDs
 *   so the character sheet knows where the modifier applies.
 *   SPELL-subject contexts populate `scopeSpellIds`.
 */
export function createCharacterEligibilityContext(
  snapshot: CharacterBuildSnapshot,
  spellAccess: readonly { spellId: string }[],
  acc: EngineAccumulatedState,
  sourceState?: CharacterEligibilityContext['sourceState']
): CharacterEligibilityContext {
  const featIds = snapshot.features.flatMap((feature) => {
    if (feature.source.kind !== 'FEAT') return []
    const featId = feature.source.featId
    return typeof featId === 'string' ? [featId] : []
  })
  const optionIds = snapshot.features.flatMap((feature) => [...getSelectedOptionIds(feature)])

  return {
    systemId: snapshot.systemId,
    raceId: snapshot.raceId,
    subraceId: snapshot.subraceId,
    classes: snapshot.classes.map((entry) => ({
      classId: entry.classId,
      level: entry.level
    })),
    abilityScores: snapshot.abilities,
    featIds: [...featIds, ...acc.unlockedFeatIds],
    spellIds: [...spellAccess.map((entry) => entry.spellId), ...acc.unlockedSpellIds],
    featureIds: snapshot.features.map((feature) => feature.featureId),
    optionIds,
    proficiencies: acc.proficiencies,
    equipment: snapshot.equipmentItems.map((item) => ({
      equipmentId: item.contentRef.definitionId,
      category: item.compiledItem.category,
      properties: item.compiledItem.properties,
      equipped: Boolean(item.equippedState),
      attuned: item.attuned
    })),
    ...(sourceState ? { sourceState } : {})
  }
}

function collectModifiers(
  grants: CompiledModifierGrant[],
  snapshot: CharacterBuildSnapshot,
  spellAccess: readonly { spellId: string }[],
  registry: CharacterAssemblyRegistry,
  acc: EngineAccumulatedState
): void {
  for (const grant of grants) {
    const restrictions = grant.restrictions

    if (
      !evaluateCharacterFacet(
        restrictions,
        createCharacterEligibilityContext(snapshot, spellAccess, acc),
        registry
      ).passed
    )
      continue

    // Extract SPELL-subject scope IDs for character sheet display
    let scopeSpellIds: string[] | undefined
    if (restrictions?.groups) {
      const spellIds: string[] = []
      for (const group of restrictions.groups) {
        for (const ctx of group.contexts ?? []) {
          if (
            ctx.subject === 'SPELL' &&
            ctx.authoringModeKind === 'SELECTED' &&
            ctx.spellIds.length > 0
          ) {
            spellIds.push(...ctx.spellIds)
          }
        }
      }
      if (spellIds.length > 0) scopeSpellIds = spellIds
    }

    const g = grant as {
      valueDomainCode?: string
      modifierKind?: string
      domain?: Record<string, unknown>
    }
    const valueDomainCode = g.valueDomainCode ?? 'UNKNOWN'
    const kind = g.modifierKind ?? 'BONUS'
    acc.modifierEntries.push({
      domainKey: buildModifierDomainKey(valueDomainCode, kind, g.domain),
      modifierKind: kind,
      grant,
      scopeSpellIds
    })
  }
}

type GrantBearingSource = Pick<
  CharacterAssemblyRegistryFeature,
  'feats' | 'modifiers' | 'proficiencies' | 'restrictions' | 'senses' | 'spells'
>

function applyGrantBearingSource(
  source: GrantBearingSource,
  ownerSource: CharacterProvenance,
  snapshot: CharacterBuildSnapshot,
  spellAccess: readonly { spellId: string }[],
  acc: EngineAccumulatedState,
  rules: RulesSystem,
  registry: CharacterAssemblyRegistry,
  context?: {
    activeLevel: number
    sourceState?: CharacterEligibilityContext['sourceState']
  }
): void {
  if (
    !evaluateCharacterFacet(
      source.restrictions,
      createCharacterEligibilityContext(snapshot, spellAccess, acc, context?.sourceState),
      registry
    ).passed
  )
    return

  for (const grantKind of rules.grantApplicationOrder) {
    switch (grantKind) {
      case 'PROFICIENCY_GRANT':
        if (source.proficiencies?.length) {
          acc.proficiencies.push(
            ...extractProficiencies(source.proficiencies, snapshot, ownerSource)
          )
        }
        break
      case 'SENSE_GRANT':
        if (source.senses?.length) {
          const activeLevel =
            context?.activeLevel ??
            snapshot.classes.reduce((total, classRecord) => total + classRecord.level, 0)
          acc.senses.push(...extractSenses(source.senses, snapshot, activeLevel, ownerSource))
        }
        break
      case 'MODIFIER_GRANT':
        if (source.modifiers?.length) {
          collectModifiers(source.modifiers, snapshot, spellAccess, registry, acc)
        }
        break
      case 'FEAT_GRANT':
        for (const grant of source.feats ?? []) {
          acc.unlockedFeatIds.push(
            ...getSelectedOrGrantedScalingIds(grant, 'featIds', snapshot, ownerSource, context)
          )
        }
        break
      case 'SPELL_GRANT':
        for (const grant of source.spells ?? []) {
          acc.unlockedSpellIds.push(
            ...getSelectedOrGrantedScalingIds(grant, 'spellIds', snapshot, ownerSource, context)
          )
        }
        break
    }
  }
}

function getSelectedOrGrantedScalingIds(
  grant: { id: string },
  idKey: 'featIds' | 'spellIds',
  snapshot: CharacterBuildSnapshot,
  ownerSource: CharacterProvenance,
  context:
    | {
        activeLevel: number
      }
    | undefined
): string[] {
  const g = grant as {
    id: string
    selectionKind?: string
    scalingKind?: string
    levels?: Array<{ level: number } & Partial<Record<typeof idKey, string[]>>>
  } & Partial<Record<typeof idKey, string[]>>

  if (g.scalingKind === 'PER_LEVEL') {
    return (g.levels ?? []).flatMap((level) => {
      if (level.level > (context?.activeLevel ?? 0)) return []

      return g.selectionKind === 'CHOSEN'
        ? getSelectedGrantTargetIds(snapshot, g.id, ownerSource, level.level)
        : (level[idKey] ?? [])
    })
  }

  return g.selectionKind === 'CHOSEN'
    ? getSelectedGrantTargetIds(snapshot, g.id, ownerSource)
    : (g[idKey] ?? [])
}

function getSelectedGrantTargetIds(
  snapshot: CharacterBuildSnapshot,
  grantId: string,
  source: CharacterProvenance,
  progressionLevel?: number
): string[] {
  const identityKey = getCharacterChosenGrantSelectionIdentityKey({
    grantId,
    source,
    progressionLevel
  })
  return (
    snapshot.chosenGrantSelections?.find(
      (selection) => getCharacterChosenGrantSelectionIdentityKey(selection) === identityKey
    )?.targetIds ?? []
  )
}

function getSelectedFeatureOptions(
  feature: CharacterBuildSnapshot['features'][number],
  registryFeature: CharacterAssemblyRegistryFeature
): Array<{
  option: NonNullable<CharacterAssemblyRegistryFeature['options']>[number]
  source: CharacterProvenance
}> {
  const selectedOptionIds = getSelectedOptionIds(feature)
  const acquisitionId = feature.acquisitionId
  if (!acquisitionId || selectedOptionIds.size === 0) return []

  return (registryFeature.options ?? [])
    .filter((option) => selectedOptionIds.has(option.id))
    .map((option) => ({
      option,
      source: {
        kind: 'OPTION',
        acquiredParentId: acquisitionId,
        optionId: option.id
      }
    }))
}

function getSelectedOptionIds(feature: CharacterBuildSnapshot['features'][number]): Set<string> {
  const optionIds = new Set<string>()

  for (const selection of feature.selections ?? []) {
    if (selection.selectionKey !== FEATURE_CHOICE_SELECTION_KEY) continue
    for (const value of selection.values) {
      if (value.kind === 'ID') optionIds.add(value.id)
      if (value.kind === 'IDS') {
        for (const id of value.ids) optionIds.add(id)
      }
    }
  }

  return optionIds
}

/* ──────────────────────────────────────────────
 * Grant applicator
 * ────────────────────────────────────────────── */

function getFeatureActiveLevel(
  snapshot: CharacterBuildSnapshot,
  feature: CharacterBuildSnapshot['features'][number]
): number {
  if (
    (feature.source.kind === 'CLASS' || feature.source.kind === 'SUBCLASS') &&
    typeof feature.source.classLevel === 'number'
  )
    return feature.source.classLevel

  if (feature.timing.kind === 'CLASS_LEVEL') return feature.timing.classLevel
  if (feature.timing.kind === 'CHARACTER_LEVEL') return feature.timing.level

  return Math.max(
    snapshot.classes.reduce((sum, classRecord) => sum + classRecord.level, 0),
    1
  )
}

/**
 * Applies all grants from the engine snapshot, following the
 * RulesSystem's featureSourceOrder and grantApplicationOrder.
 *
 * Rule ordering is defined in `dnd5e2014/RULE_ORDER.md` §1 and §2.
 */
export function applyGrants(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem,
  spellAccess: readonly { spellId: string }[]
): EngineAccumulatedState {
  const acc: EngineAccumulatedState = {
    proficiencies: [],
    senses: [],
    modifierEntries: [],
    unlockedFeatIds: [],
    unlockedSpellIds: [],
    activeEquipmentInstanceIds: []
  }

  // Sort active features by source order
  const sourceOrderIndex = new Map<string, number>(
    rules.featureSourceOrder.map((kind: string, i: number) => [kind, i] as [string, number])
  )
  const sortedFeatures = [...snapshot.features].sort((a, b) => {
    const ai = sourceOrderIndex.get(a.source.kind) ?? 999
    const bi = sourceOrderIndex.get(b.source.kind) ?? 999
    return ai - bi
  })
  for (const [classIndex, classRecord] of snapshot.classes.entries()) {
    const compiledClass = registry.classes[classRecord.classId]
    if (compiledClass) {
      const proficiencies =
        classIndex > 0 && compiledClass.category === 'BASE'
          ? compiledClass.multiclass.proficiencies
          : compiledClass.proficiencies
      applyClassGrants(
        compiledClass,
        { kind: 'CLASS', classId: classRecord.classId },
        snapshot,
        spellAccess,
        acc,
        rules,
        registry,
        classRecord.level,
        proficiencies
      )
    }

    const compiledSubclass = classRecord.subclassId
      ? registry.classes[classRecord.subclassId]
      : undefined
    if (
      compiledSubclass?.category === 'SUBCLASS' &&
      compiledSubclass.parentClassId === classRecord.classId
    ) {
      applyClassGrants(
        compiledSubclass,
        { kind: 'SUBCLASS', subclassId: compiledSubclass.id },
        snapshot,
        spellAccess,
        acc,
        rules,
        registry,
        classRecord.level
      )
    }
  }

  const background = snapshot.backgroundId
    ? registry.backgrounds?.[snapshot.backgroundId]
    : undefined
  if (background && snapshot.backgroundId) {
    applyGrantBearingSource(
      background,
      { kind: 'BACKGROUND', backgroundId: snapshot.backgroundId },
      snapshot,
      spellAccess,
      acc,
      rules,
      registry
    )
  }

  for (const feature of sortedFeatures) {
    const registryFeature = registry.features[feature.featureId]
    const grantContext = {
      activeLevel: getFeatureActiveLevel(snapshot, feature)
    }
    if (registryFeature) {
      applyGrantBearingSource(
        registryFeature,
        feature.source,
        snapshot,
        spellAccess,
        acc,
        rules,
        registry,
        grantContext
      )

      for (const selected of getSelectedFeatureOptions(feature, registryFeature)) {
        applyGrantBearingSource(
          selected.option,
          selected.source,
          snapshot,
          spellAccess,
          acc,
          rules,
          registry,
          grantContext
        )
      }
    }

    // Apply grants from feats referenced by this feature's source
    if (feature.source.kind === 'FEAT') {
      const featId = feature.source.featId
      if (typeof featId === 'string') {
        const compiledFeat = registry.feats[featId]
        if (compiledFeat) {
          applyGrantBearingSource(
            compiledFeat,
            feature.source,
            snapshot,
            spellAccess,
            acc,
            rules,
            registry,
            grantContext
          )
        }
      }
    }

    // Equipment feature grants are resolved via FEATURE source kind from equipped items.
    // Equipment modifiers from registry.equipment are applied after equipped item
    // tracking resolves which items are active.
  }

  applyEquipmentGrants(snapshot, spellAccess, acc, rules, registry)

  return acc
}

function applyEquipmentGrants(
  snapshot: CharacterBuildSnapshot,
  spellAccess: readonly { spellId: string }[],
  acc: EngineAccumulatedState,
  rules: RulesSystem,
  registry: CharacterAssemblyRegistry
): void {
  const activeLevel = Math.max(snapshot.totalLevel, 1)

  for (const item of snapshot.equipmentItems) {
    if (item.compiledItem.requiresAttunement && !item.attuned) continue

    const sourceState = {
      carried: true,
      equipped: Boolean(item.equippedState),
      attuned: item.attuned
    }
    if (
      !evaluateCharacterFacet(
        item.compiledItem.restrictions,
        createCharacterEligibilityContext(snapshot, spellAccess, acc, sourceState),
        registry
      ).passed
    )
      continue

    acc.activeEquipmentInstanceIds.push(item.instanceId)
    for (const feature of item.compiledItem.features ?? []) {
      applyGrantBearingSource(
        feature,
        { kind: 'FEATURE', featureId: feature.id },
        snapshot,
        spellAccess,
        acc,
        rules,
        registry,
        {
          activeLevel,
          sourceState
        }
      )
    }
  }
}

function applyClassGrants(
  compiledClass: CompiledClass,
  ownerSource: CharacterProvenance,
  snapshot: CharacterBuildSnapshot,
  spellAccess: readonly { spellId: string }[],
  acc: EngineAccumulatedState,
  rules: RulesSystem,
  registry: CharacterAssemblyRegistry,
  activeLevel: number,
  proficiencies: CompiledProficiencyGrant[] | undefined = compiledClass.proficiencies
): void {
  applyGrantBearingSource(
    { ...compiledClass, proficiencies },
    ownerSource,
    snapshot,
    spellAccess,
    acc,
    rules,
    registry,
    { activeLevel }
  )
}
