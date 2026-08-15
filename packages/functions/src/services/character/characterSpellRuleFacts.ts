import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledFeature, CompiledSpellGrant } from '@artificer-toolkit/shared/compilers'
import {
  getChosenGrantTargetIds,
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import type { CharacterProvenance } from '@artificer-toolkit/shared/subjects/authored'

type SpellAccessCandidate = CharacterRulePolicyInput['spellAccessCandidates'][number]
type SupportedSpellSource = Extract<
  CharacterProvenance,
  { kind: 'CLASS' | 'SUBCLASS' | 'RACE' | 'SUBRACE' }
>

type CandidateSource = {
  kind: SupportedSpellSource['kind']
  id: string
  owningClassId: string | null
  activeLevel: number
  specializationId: string | null
  inheritedFeatureIds: ReadonlySet<string>
}

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

function chargeDescriptor(grant: CompiledSpellGrant): SpellAccessCandidate['charge'] {
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
  }
}

function sourceInstanceId(source: CandidateSource, featureId: string, grantId: string): string {
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
  candidates: SpellAccessCandidate[]
  feature: CompiledFeature
  grant: CompiledSpellGrant
  snapshot: CharacterBuildSnapshot
  source: CandidateSource
}): void {
  const { candidates, feature, grant, snapshot, source } = params
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
        charge: chargeDescriptor(grant)
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
  candidates: SpellAccessCandidate[]
  features: readonly CompiledFeature[] | undefined
  snapshot: CharacterBuildSnapshot
  source: CandidateSource
}): void {
  for (const feature of params.features ?? []) {
    for (const grant of feature.spells ?? []) {
      appendGrantCandidates({ ...params, feature, grant })
    }
  }
}

export function buildCharacterSpellRuleFacts(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): Pick<CharacterRulePolicyInput, 'spellAccessCandidates' | 'spellClasses'> {
  const spellAccessCandidates: SpellAccessCandidate[] = []

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

  return {
    spellAccessCandidates,
    spellClasses: snapshot.classes.map(({ classId }) => ({ classId }))
  }
}
