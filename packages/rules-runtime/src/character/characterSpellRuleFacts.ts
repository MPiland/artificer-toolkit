import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledFeature, CompiledSpellGrant } from '@artificer-toolkit/shared/compilers'
import {
  getChosenGrantTargetIds,
  SPELL_GRANT_ACCESS,
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import type { CharacterProvenance } from '@artificer-toolkit/shared/subjects/authored'

import { systemVocabularyRegistry } from '../platformPolicyModules.js'
import { getCharacterGrantFoldSelectedOptionIds } from './characterGrantFoldSourceFacts.js'

export type CharacterSpellAccessCandidate =
  CharacterRulePolicyInput['spellAccessCandidates'][number]
type SupportedSpellSource = Extract<
  CharacterProvenance,
  { kind: 'CLASS' | 'SUBCLASS' | 'RACE' | 'SUBRACE' | 'FEAT' | 'BACKGROUND' | 'OPTION' }
>

type CandidateSource = {
  id: string
  owningClassId: string | null
  activeLevel: number
  specializationId: string | null
  inheritedFeatureIds: ReadonlySet<string>
} & (
  | { kind: Exclude<SupportedSpellSource['kind'], 'OPTION'>; acquiredParentId?: undefined }
  /** The acquisition owning a chosen option; the Builder keys the option's chosen grants by it. */
  | { kind: 'OPTION'; acquiredParentId: string }
)

function collectSpecializationRestrictionIds(restrictions: unknown): string[] | null {
  const ids: string[] = []
  let found = false

  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry)
      return
    }

    const record = value as Record<string, unknown>
    if (record.predicateCode === 'SUBCLASS_SPECIALIZATION') {
      found = true
      for (const id of Array.isArray(record.specializationIds) ? record.specializationIds : []) {
        ids.push(String(id))
      }
    }
    for (const child of Object.values(record)) visit(child)
  }

  visit(restrictions)
  return found ? [...new Set(ids)] : null
}

export function isCharacterSpellActionAccessCandidate(
  candidate: CharacterSpellAccessCandidate
): boolean {
  return candidate.selectionKind !== 'CHOSEN' || candidate.selectedByCharacter
}

export function collectCharacterRuleInputSpellIds(input: {
  referenceSpellIds?: readonly string[]
  spellAccessCandidates: readonly CharacterSpellAccessCandidate[]
  spellSources?: readonly { spellId: string }[]
}): ReadonlySet<string> {
  return new Set([
    ...(input.spellSources ?? []).map((source) => source.spellId),
    ...input.spellAccessCandidates
      .filter(isCharacterSpellActionAccessCandidate)
      .map((candidate) => candidate.spellId),
    ...(input.referenceSpellIds ?? [])
  ])
}

/** The authored grant an access candidate or access came from, by the same source rules that built it. */
export function findCompiledSpellGrant(
  registry: CharacterAssemblyRegistry,
  access: Pick<
    CharacterSpellAccessCandidate,
    'sourceKind' | 'sourceId' | 'sourceFeatureId' | 'grantId'
  >
): CompiledSpellGrant | undefined {
  const spells = (() => {
    switch (access.sourceKind) {
      case 'CLASS':
      case 'SUBCLASS':
        return registry.classes[access.sourceId]?.features?.find(
          (feature) => feature.id === access.sourceFeatureId
        )?.spells
      case 'RACE':
      case 'SUBRACE':
        return registry.races[access.sourceId]?.features?.find(
          (feature) => feature.id === access.sourceFeatureId
        )?.spells
      case 'FEAT':
        return access.sourceFeatureId === access.sourceId
          ? registry.feats[access.sourceId]?.spells
          : registry.features[access.sourceFeatureId]?.spells
      case 'BACKGROUND':
        return registry.features[access.sourceFeatureId]?.spells
      case 'OPTION':
        return registry.features[access.sourceFeatureId]?.options?.find(
          (option) => option.id === access.sourceId
        )?.spells
    }
  })()
  return spells?.find((grant) => grant.id === access.grantId)
}

function chargeDescriptor(grant: CompiledSpellGrant): CharacterSpellAccessCandidate['charge'] {
  const charge = grant.charges
  if (!charge) return null
  return {
    id: charge.id,
    limitKind: charge.limitKind,
    resetKind: 'resetKind' in charge ? charge.resetKind : null
  }
}

function sourceProvenance(source: CandidateSource): SupportedSpellSource {
  switch (source.kind) {
    case 'CLASS':
      return { kind: source.kind, classId: source.id }
    case 'SUBCLASS':
      return { kind: source.kind, subclassId: source.id }
    case 'RACE':
      return { kind: source.kind, raceId: source.id }
    case 'SUBRACE':
      return { kind: source.kind, subraceId: source.id }
    case 'FEAT':
      return { kind: source.kind, featId: source.id }
    case 'BACKGROUND':
      return { kind: source.kind, backgroundId: source.id }
    case 'OPTION':
      return {
        kind: source.kind,
        acquiredParentId: source.acquiredParentId,
        optionId: source.id
      }
  }
}

function sourceInstanceId(source: CandidateSource, featureId: string, grantId: string): string {
  // The acquisition already names the feature and class an option belongs to, and action source ids
  // are bounded, so an option's identity stays short.
  if (source.kind === 'OPTION') {
    return `${source.kind}:${source.acquiredParentId}:${source.id}:${grantId}`
  }
  return source.owningClassId
    ? `${source.kind}:${source.id}:${source.owningClassId}:${featureId}:${grantId}`
    : `${source.kind}:${source.id}:${featureId}:${grantId}`
}

function candidateTargets(
  grant: CompiledSpellGrant,
  authoredSpellIds: readonly string[],
  chosenSpellIds: readonly string[]
): Array<{ spellId: string; selectedByCharacter: boolean }> {
  if (grant.selectionKind !== 'CHOSEN') {
    return authoredSpellIds.map((spellId) => ({ spellId, selectedByCharacter: false }))
  }

  const selected = chosenSpellIds.map((spellId) => ({
    spellId,
    selectedByCharacter: true
  }))
  const selectedIds = new Set(chosenSpellIds)
  return [
    ...selected,
    ...authoredSpellIds
      .filter((spellId) => !selectedIds.has(spellId))
      .map((spellId) => ({ spellId, selectedByCharacter: false }))
  ]
}

function appendGrantCandidates(params: {
  candidates: CharacterSpellAccessCandidate[]
  feature: Pick<CompiledFeature, 'id' | 'availableAtLevel'>
  grant: CompiledSpellGrant
  snapshot: CharacterBuildSnapshot
  source: CandidateSource
}): void {
  const { candidates, feature, grant, snapshot, source } = params
  // A class-list-only grant joins a spell list and casts nothing (D175); see spellClassListAdditions.
  if (grant.access === SPELL_GRANT_ACCESS.CLASS_LIST_ONLY) return
  const provenance = sourceProvenance(source)
  const instanceId = sourceInstanceId(source, feature.id, grant.id)
  const specializationRestrictionIds = collectSpecializationRestrictionIds(grant.restrictions)

  const append = (
    authoredSpellIds: readonly string[],
    chosenSpellIds: readonly string[],
    authoringMode: 'ALL' | 'SELECTED',
    progressionLevel: number | null
  ) => {
    for (const target of candidateTargets(grant, authoredSpellIds, chosenSpellIds)) {
      candidates.push({
        sequence: candidates.length,
        accessId: `${instanceId}:${target.spellId}`,
        sourceInstanceId: instanceId,
        spellId: target.spellId,
        sourceFeatureId: feature.id,
        grantId: grant.id,
        sourceKind: source.kind,
        sourceId: source.id,
        acquiredParentId: source.acquiredParentId ?? null,
        owningClassId: source.owningClassId,
        activeSourceLevel: source.activeLevel,
        featureAvailableAtLevel: feature.availableAtLevel ?? 1,
        inheritedFeatureDuplicate: source.inheritedFeatureIds.has(feature.id),
        specializationId: source.specializationId,
        specializationRestrictionIds,
        selectionKind: grant.selectionKind,
        authoringMode,
        selectedByCharacter: target.selectedByCharacter,
        scalingKind: grant.scalingKind,
        scalingSource: grant.scalingKind === 'PER_LEVEL' ? grant.scalingSource : null,
        progressionLevel,
        totalLevel: snapshot.totalLevel,
        classLevel: source.owningClassId ? source.activeLevel : null,
        attributes: grant.attributes ?? [],
        castAtLevel: grant.castAtLevel ?? null,
        castingAbility: grant.castingAbility ?? null,
        charge: chargeDescriptor(grant),
        allowedCreatureTypeIds: grant.allowedCreatureTypeIds ?? [],
        perTargetLockout: grant.perTargetLockout !== undefined,
        slotPoolCode: grant.slotCost
          ? systemVocabularyRegistry.requireCode(
              snapshot.systemId,
              'spellSlotPool',
              grant.slotCost.poolCode
            ).code
          : null
      })
    }
  }

  if (grant.scalingKind === 'NONE') {
    append(
      grant.authoringModeKind === 'SELECTED' ? (grant.spellIds ?? []) : [],
      grant.selectionKind === 'CHOSEN'
        ? getChosenGrantTargetIds(snapshot, grant.id, provenance)
        : [],
      grant.authoringModeKind,
      null
    )
    return
  }

  for (const level of grant.levels) {
    append(
      level.authoringModeKind === 'SELECTED' ? (level.spellIds ?? []) : [],
      grant.selectionKind === 'CHOSEN'
        ? getChosenGrantTargetIds(snapshot, grant.id, provenance, level.level)
        : [],
      level.authoringModeKind,
      level.level
    )
  }
}

function appendFeatureCandidates(params: {
  candidates: CharacterSpellAccessCandidate[]
  features: readonly Pick<CompiledFeature, 'id' | 'availableAtLevel' | 'spells'>[] | undefined
  snapshot: CharacterBuildSnapshot
  source: CandidateSource
}): void {
  for (const feature of params.features ?? []) {
    for (const grant of feature.spells ?? []) {
      appendGrantCandidates({ ...params, feature, grant })
    }
  }
}

/**
 * Spell grants on acquired Feats, Background features and chosen options. Class, subclass and
 * heritage features reach access through their compiled definitions, so only their selected
 * options are read from the acquisitions here.
 */
function appendChosenFeatureCandidates(
  candidates: CharacterSpellAccessCandidate[],
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): void {
  const base = { specializationId: null, inheritedFeatureIds: new Set<string>() }
  const featRoots = new Set<string>()
  for (const acquired of snapshot.features) {
    const definition = registry.features[acquired.featureId]
    const { source } = acquired
    const features = definition ? [{ id: acquired.featureId, ...definition }] : undefined
    if (source.kind === 'FEAT') {
      const featSource = {
        ...base,
        kind: 'FEAT' as const,
        id: source.featId,
        owningClassId: null,
        activeLevel: snapshot.totalLevel
      }
      if (!featRoots.has(source.featId)) {
        featRoots.add(source.featId)
        appendFeatureCandidates({
          candidates,
          features: [{ id: source.featId, spells: registry.feats[source.featId]?.spells }],
          snapshot,
          source: featSource
        })
      }
      appendFeatureCandidates({ candidates, features, snapshot, source: featSource })
    } else if (source.kind === 'BACKGROUND') {
      appendFeatureCandidates({
        candidates,
        features,
        snapshot,
        source: {
          ...base,
          kind: 'BACKGROUND',
          id: source.backgroundId,
          owningClassId: null,
          activeLevel: snapshot.totalLevel
        }
      })
    }

    if (!acquired.acquisitionId || !definition) continue
    const selected = getCharacterGrantFoldSelectedOptionIds(acquired)
    const timedClassId = acquired.timing.kind === 'CLASS_LEVEL' ? acquired.timing.classId : null
    const classLevel = snapshot.classes.find((entry) => entry.classId === timedClassId)?.level
    for (const option of definition.options ?? []) {
      if (!selected.has(option.id)) continue
      appendFeatureCandidates({
        candidates,
        features: [{ id: acquired.featureId, spells: option.spells }],
        snapshot,
        source: {
          ...base,
          kind: 'OPTION',
          id: option.id,
          acquiredParentId: acquired.acquisitionId,
          owningClassId: classLevel === undefined ? null : timedClassId,
          activeLevel: classLevel ?? snapshot.totalLevel
        }
      })
    }
  }
}

export function buildCharacterSpellRuleFacts(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): Pick<CharacterRulePolicyInput, 'spellAccessCandidates' | 'spellClasses'> {
  const spellAccessCandidates: CharacterSpellAccessCandidate[] = []

  for (const classEntry of snapshot.classes) {
    const compiledClass = registry.classes[classEntry.classId]
    if (compiledClass) {
      appendFeatureCandidates({
        candidates: spellAccessCandidates,
        features: compiledClass.features,
        snapshot,
        source: {
          kind: 'CLASS',
          id: classEntry.classId,
          owningClassId: classEntry.classId,
          activeLevel: classEntry.level,
          specializationId: classEntry.specializationId ?? null,
          inheritedFeatureIds: new Set()
        }
      })
    }

    const compiledSubclass = classEntry.subclassId
      ? registry.classes[classEntry.subclassId]
      : undefined
    if (
      compiledSubclass?.category === 'SUBCLASS' &&
      compiledSubclass.parentClassId === classEntry.classId
    ) {
      appendFeatureCandidates({
        candidates: spellAccessCandidates,
        features: compiledSubclass.features,
        snapshot,
        source: {
          kind: 'SUBCLASS',
          id: compiledSubclass.id,
          owningClassId: classEntry.classId,
          activeLevel: classEntry.level,
          specializationId: classEntry.specializationId ?? null,
          inheritedFeatureIds: new Set()
        }
      })
    }
  }

  const compiledSubrace = snapshot.subraceId ? registry.races[snapshot.subraceId] : undefined
  const baseRaceId =
    snapshot.raceId ??
    (compiledSubrace?.category === 'SUBRACE' ? compiledSubrace.parentRaceId : undefined)
  const compiledBaseRace = baseRaceId ? registry.races[baseRaceId] : undefined
  const inheritedFeatureIds = new Set(
    compiledBaseRace?.features?.map((feature) => feature.id) ?? []
  )

  if (compiledBaseRace && baseRaceId) {
    appendFeatureCandidates({
      candidates: spellAccessCandidates,
      features: compiledBaseRace.features,
      snapshot,
      source: {
        kind: 'RACE',
        id: baseRaceId,
        owningClassId: null,
        activeLevel: snapshot.totalLevel,
        specializationId: null,
        inheritedFeatureIds: new Set()
      }
    })
  }

  if (compiledSubrace && snapshot.subraceId) {
    appendFeatureCandidates({
      candidates: spellAccessCandidates,
      features: compiledSubrace.features,
      snapshot,
      source: {
        kind: 'SUBRACE',
        id: snapshot.subraceId,
        owningClassId: null,
        activeLevel: snapshot.totalLevel,
        specializationId: null,
        inheritedFeatureIds
      }
    })
  }

  appendChosenFeatureCandidates(spellAccessCandidates, snapshot, registry)

  return {
    spellAccessCandidates,
    spellClasses: snapshot.classes.map(({ classId }) => ({ classId }))
  }
}
