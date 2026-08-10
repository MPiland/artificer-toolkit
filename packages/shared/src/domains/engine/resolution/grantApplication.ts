import { getChosenGrantTargetIds, type CharacterBuildSnapshot } from '../snapshot.js'
import type { CompiledModifierGrant } from '../../grants/compilers/modifier.js'
import type { CompiledProficiencyGrant } from '../../grants/compilers/proficiency.js'
import type { CompiledSenseGrant } from '../../grants/compilers/sense.js'
import type { CompiledRange } from '../../shared/compilers/range.js'
import type {
  EngineEquipmentFeatureChargeUse,
  EngineProficiency,
  EngineSense
} from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterAssemblyRegistry, CharacterAssemblyRegistryFeature } from '../registry.js'
import {
  getCharacterProvenanceIdentityKey,
  type CharacterProvenance
} from '../../subjects/authored/character/intent.js'
import type {
  CharacterAuthoredSourceKind,
  CharacterMechanicSourceRef
} from '../../character/sheetCalculation.js'
import { evaluateCharacterFacet, type CharacterEligibilityContext } from '../prerequisiteEval.js'
import { buildModifierDomainKey } from './modifierDomainKey.js'
import { getSelectedOptionIds } from './featureSelection.js'

export interface EngineAccumulatedState {
  proficiencies: EngineProficiency[]
  senses: EngineSense[]
  modifierEntries: Array<{
    domainKey: string
    modifierKind: string
    grant: CompiledModifierGrant
    source: CharacterMechanicSourceRef
    scopeSpellIds?: string[]
  }>
  unlockedFeatIds: string[]
  unlockedSpellIds: string[]
  activeEquipmentInstanceIds: string[]
  equipmentFeatureChargeUses: EngineEquipmentFeatureChargeUse[]
}

export function createEngineAccumulatedState(): EngineAccumulatedState {
  return {
    proficiencies: [],
    senses: [],
    modifierEntries: [],
    unlockedFeatIds: [],
    unlockedSpellIds: [],
    activeEquipmentInstanceIds: [],
    equipmentFeatureChargeUses: []
  }
}

function extractProficiencies(
  grants: CompiledProficiencyGrant[],
  snapshot: CharacterBuildSnapshot,
  ownerSource: CharacterProvenance,
  mechanicSource: CharacterMechanicSourceRef
): EngineProficiency[] {
  const out: EngineProficiency[] = []
  for (const grant of grants) {
    const scaling = grantScaling(grant)
    if (grant.selectionKind === 'CHOSEN') {
      pushProficiencies(
        out,
        grant,
        getChosenGrantTargetIds(snapshot, grant.id, ownerSource),
        scaling,
        mechanicSource
      )
      continue
    }
    const mode = (grant as { authoringModeKind?: string }).authoringModeKind
    if (mode === 'ALL') {
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
        source: mechanicSource,
        grantId: grant.id,
        ...(category ? { category } : {})
      })
      continue
    }
    switch (grant.proficiencyKind) {
      case 'SKILL':
        for (const id of (grant as CompiledProficiencyGrant<'SKILL'> & { skillIds?: string[] })
          .skillIds ?? [])
          out.push({
            kind: 'SKILL',
            subjectId: id,
            scaling,
            source: mechanicSource,
            grantId: grant.id
          })
        break
      case 'SAVE_ABILITY':
        for (const ability of (
          grant as CompiledProficiencyGrant<'SAVE_ABILITY'> & { abilities?: string[] }
        ).abilities ?? [])
          out.push({
            kind: 'SAVE_ABILITY',
            subjectId: ability,
            scaling,
            source: mechanicSource,
            grantId: grant.id
          })
        break
      case 'LANGUAGE':
        for (const id of (
          grant as CompiledProficiencyGrant<'LANGUAGE'> & { languageIds?: string[] }
        ).languageIds ?? [])
          out.push({
            kind: 'LANGUAGE',
            subjectId: id,
            scaling,
            source: mechanicSource,
            grantId: grant.id
          })
        break
      case 'EQUIPMENT':
        for (const id of (
          grant as CompiledProficiencyGrant<'EQUIPMENT'> & { equipmentIds?: string[] }
        ).equipmentIds ?? [])
          out.push({
            kind: 'EQUIPMENT',
            subjectId: id,
            scaling,
            source: mechanicSource,
            grantId: grant.id
          })
        break
      case 'EQUIPMENT_PROPERTY': {
        const g = grant as CompiledProficiencyGrant<'EQUIPMENT_PROPERTY'> & {
          properties?: string[]
          category?: EngineProficiency['category']
        }
        for (const property of g.properties ?? [])
          out.push({
            kind: 'EQUIPMENT_PROPERTY',
            subjectId: property,
            scaling,
            source: mechanicSource,
            grantId: grant.id,
            ...(g.category ? { category: g.category } : {})
          })
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
  scaling: EngineProficiency['scaling'],
  mechanicSource: CharacterMechanicSourceRef
): void {
  const category =
    grant.proficiencyKind === 'EQUIPMENT_PROPERTY'
      ? (
          grant as CompiledProficiencyGrant<'EQUIPMENT_PROPERTY'> & {
            category?: EngineProficiency['category']
          }
        ).category
      : undefined
  for (const id of ids)
    out.push({
      kind: grant.proficiencyKind,
      subjectId: id,
      scaling,
      source: mechanicSource,
      grantId: grant.id,
      ...(category ? { category } : {})
    })
}

function grantScaling(grant: CompiledProficiencyGrant): EngineProficiency['scaling'] {
  const level = (grant as { level?: string }).level
  return level === 'DOUBLE' ? 'DOUBLE' : level === 'HALF' ? 'HALF' : 'FULL'
}

function extractSenses(
  grants: CompiledSenseGrant[],
  snapshot: CharacterBuildSnapshot,
  activeLevel: number,
  ownerSource: CharacterProvenance
): EngineSense[] {
  const out: EngineSense[] = []
  for (const grant of grants) {
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
        for (const senseCode of g.selectionKind === 'CHOSEN'
          ? getChosenGrantTargetIds(snapshot, grant.id, ownerSource, level.level)
          : (level.senseIds ?? []))
          out.push({ senseCode, range: g.range })
      }
      continue
    }
    for (const senseCode of g.selectionKind === 'CHOSEN'
      ? getChosenGrantTargetIds(snapshot, grant.id, ownerSource)
      : (g.senseIds ?? []))
      out.push({ senseCode, range: g.range })
  }
  return out
}

export function createCharacterEligibilityContext(
  snapshot: CharacterBuildSnapshot,
  spellAccess: readonly { spellId: string }[],
  acc: EngineAccumulatedState,
  sourceState?: CharacterEligibilityContext['sourceState']
): CharacterEligibilityContext {
  const featIds = snapshot.features.flatMap((feature) =>
    feature.source.kind === 'FEAT' && typeof feature.source.featId === 'string'
      ? [feature.source.featId]
      : []
  )
  const optionIds = snapshot.features.flatMap((feature) => [...getSelectedOptionIds(feature)])
  return {
    systemId: snapshot.systemId,
    raceId: snapshot.raceId,
    subraceId: snapshot.subraceId,
    classes: snapshot.classes.map((entry) => ({ classId: entry.classId, level: entry.level })),
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

function toCharacterAuthoredSourceKind(
  source: Exclude<CharacterProvenance, { kind: 'MANUAL' }>
): CharacterAuthoredSourceKind {
  switch (source.kind) {
    case 'ANCESTRY':
      return 'ANCESTRY'
    case 'BACKGROUND':
      return 'BACKGROUND'
    case 'CLASS':
      return 'CLASS'
    case 'FEAT':
      return 'FEAT'
    case 'FEATURE':
      return 'FEATURE'
    case 'OPTION':
      return 'OPTION'
    case 'RACE':
      return 'RACE'
    case 'SUBRACE':
      return 'SUBRACE'
    case 'SUBCLASS':
      return 'SUBCLASS'
  }
}

export function createAuthoredMechanicSource(
  snapshot: CharacterBuildSnapshot,
  source: CharacterProvenance,
  definitionId: string,
  sourceInstanceId = getCharacterProvenanceIdentityKey(source)
): CharacterMechanicSourceRef {
  return source.kind === 'MANUAL'
    ? { kind: 'SYSTEM', systemId: snapshot.systemId }
    : {
        kind: 'AUTHORED',
        sourceKind: toCharacterAuthoredSourceKind(source),
        definitionId,
        sourceInstanceId
      }
}

function collectModifiers(
  grants: CompiledModifierGrant[],
  snapshot: CharacterBuildSnapshot,
  spellAccess: readonly { spellId: string }[],
  registry: CharacterAssemblyRegistry,
  acc: EngineAccumulatedState,
  source: CharacterMechanicSourceRef
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
    const spellIds = restrictions?.groups
      ?.flatMap((group) => group.contexts ?? [])
      .flatMap((context) =>
        context.subject === 'SPELL' &&
        context.authoringModeKind === 'SELECTED' &&
        context.spellIds.length > 0
          ? context.spellIds
          : []
      )
    const g = grant as {
      valueDomainCode?: string
      modifierKind?: string
      domain?: Record<string, unknown>
    }
    const valueDomainCode = g.valueDomainCode ?? 'UNKNOWN'
    const modifierKind = g.modifierKind ?? 'BONUS'
    acc.modifierEntries.push({
      domainKey: buildModifierDomainKey(valueDomainCode, modifierKind, g.domain),
      modifierKind,
      grant,
      source,
      ...(spellIds?.length ? { scopeSpellIds: spellIds } : {})
    })
  }
}

type GrantBearingSource = Pick<
  CharacterAssemblyRegistryFeature,
  'feats' | 'modifiers' | 'proficiencies' | 'restrictions' | 'senses' | 'spells'
>

export function applyGrantBearingSource(
  source: GrantBearingSource,
  ownerSource: CharacterProvenance,
  mechanicSource: CharacterMechanicSourceRef,
  snapshot: CharacterBuildSnapshot,
  spellAccess: readonly { spellId: string }[],
  acc: EngineAccumulatedState,
  rules: RulesSystem,
  registry: CharacterAssemblyRegistry,
  context?: { activeLevel: number; sourceState?: CharacterEligibilityContext['sourceState'] }
): boolean {
  if (
    !evaluateCharacterFacet(
      source.restrictions,
      createCharacterEligibilityContext(snapshot, spellAccess, acc, context?.sourceState),
      registry
    ).passed
  )
    return false
  for (const grantKind of rules.grantApplicationOrder) {
    switch (grantKind) {
      case 'PROFICIENCY_GRANT':
        if (source.proficiencies?.length)
          acc.proficiencies.push(
            ...extractProficiencies(source.proficiencies, snapshot, ownerSource, mechanicSource)
          )
        break
      case 'SENSE_GRANT':
        if (source.senses?.length)
          acc.senses.push(
            ...extractSenses(
              source.senses,
              snapshot,
              context?.activeLevel ??
                snapshot.classes.reduce((total, classRecord) => total + classRecord.level, 0),
              ownerSource
            )
          )
        break
      case 'MODIFIER_GRANT':
        if (source.modifiers?.length)
          collectModifiers(source.modifiers, snapshot, spellAccess, registry, acc, mechanicSource)
        break
      case 'FEAT_GRANT':
        for (const grant of source.feats ?? [])
          acc.unlockedFeatIds.push(
            ...getSelectedOrGrantedScalingIds(grant, 'featIds', snapshot, ownerSource, context)
          )
        break
      case 'SPELL_GRANT':
        for (const grant of source.spells ?? [])
          acc.unlockedSpellIds.push(
            ...getSelectedOrGrantedScalingIds(grant, 'spellIds', snapshot, ownerSource, context)
          )
        break
    }
  }
  return true
}

function getSelectedOrGrantedScalingIds(
  grant: { id: string },
  idKey: 'featIds' | 'spellIds',
  snapshot: CharacterBuildSnapshot,
  ownerSource: CharacterProvenance,
  context: { activeLevel: number } | undefined
): string[] {
  const g = grant as {
    id: string
    selectionKind?: string
    scalingKind?: string
    levels?: Array<{ level: number } & Partial<Record<typeof idKey, string[]>>>
  } & Partial<Record<typeof idKey, string[]>>
  if (g.scalingKind === 'PER_LEVEL')
    return (g.levels ?? []).flatMap((level) =>
      level.level > (context?.activeLevel ?? 0)
        ? []
        : g.selectionKind === 'CHOSEN'
          ? getChosenGrantTargetIds(snapshot, g.id, ownerSource, level.level)
          : (level[idKey] ?? [])
    )
  return g.selectionKind === 'CHOSEN'
    ? getChosenGrantTargetIds(snapshot, g.id, ownerSource)
    : (g[idKey] ?? [])
}
