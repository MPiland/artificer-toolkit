import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import {
  compileBackground,
  compileClass,
  compileFeat,
  compileFeature,
  compileRace,
  compileResolvedEquipment
} from '@artificer-toolkit/shared/compilers'
import type {
  CharacterAcquisitionTiming,
  CharacterAuthored,
  CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'
import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'

import type {
  CharacterBuilderRegistry,
  CharacterBuilderResolution
} from './builderService.js'

type EngineFeatureSource = CharacterBuildSnapshot['features'][number]['source']
type EngineFeatureTiming = CharacterBuildSnapshot['features'][number]['timing']

function collectRegistryFeatures(registry: CharacterBuilderRegistry) {
  return [
    ...registry.features,
    ...registry.races.flatMap((race) => [
      ...(race.features ?? []),
      ...(race.ancestry?.options.flatMap((option) => option.features ?? []) ?? [])
    ]),
    ...registry.classes.flatMap((classRecord) => classRecord.features ?? []),
    ...registry.backgrounds.flatMap((background) => background.features ?? []),
    ...(registry.feats ?? []).flatMap((feat) => feat.features ?? [])
  ]
}

export function createCharacterAssemblyRegistry(
  registry: CharacterBuilderRegistry
): CharacterAssemblyRegistry {
  const features = collectRegistryFeatures(registry)

  return {
    backgrounds: Object.fromEntries(
      registry.backgrounds.map((record) => [record.id, compileBackground(record)])
    ),
    classes: Object.fromEntries(
      registry.classes.map((record) => [record.id, compileClass(record)])
    ),
    equipment: Object.fromEntries(
      registry.equipment.map((record) => [record.id, compileResolvedEquipment(record)])
    ),
    feats: Object.fromEntries(
      (registry.feats ?? []).map((record) => [record.id, compileFeat(record)])
    ),
    features: Object.fromEntries(
      features.map((record) => [record.id, compileFeature(record)])
    ),
    races: Object.fromEntries(
      registry.races.map((record) => [record.id, compileRace(record)])
    ),
    // Spell card mechanics are loaded through the Sheet projection. The current
    // engine resolves granted spell IDs from compiled grant owners and does not
    // hydrate or inspect the spell aggregates themselves.
    spells: {},
    system: registry.system
      ? {
          skills: registry.system.skills ?? []
        }
      : undefined
  }
}

export function createCharacterEngineFeatures(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution
): CharacterBuildSnapshot['features'] {
  const registryFeatures = collectRegistryFeatures(resolution.registry)
  const automaticFeatures = resolution.grants.features.map((grant) => {
    const feature = registryFeatures.find((candidate) => candidate.id === grant.id)
    const acquisition = character.intent.featureAcquisitions.find((candidate) => (
      candidate.featureId === grant.id
      && isSameCharacterProvenanceIdentity(candidate.source, grant.source)
    ))
    const timing = acquisition?.timing ?? inferAutomaticFeatureTiming(
      character,
      grant.source,
      feature?.availableAtLevel ?? 1
    )

    return {
      ...(acquisition ? { acquisitionId: acquisition.id } : {}),
      featureId: grant.id,
      source: toCharacterEngineFeatureSource(grant.source),
      timing: toCharacterEngineFeatureTiming(timing),
      ...(acquisition?.selections ? { selections: acquisition.selections } : {})
    }
  })
  const explicitFeatures = character.intent.featureAcquisitions
    .filter((acquisition) => !resolution.grants.features.some((grant) => (
      acquisition.featureId === grant.id
      && isSameCharacterProvenanceIdentity(acquisition.source, grant.source)
    )))
    .map((acquisition) => ({
      acquisitionId: acquisition.id,
      featureId: acquisition.featureId,
      source: toCharacterEngineFeatureSource(acquisition.source),
      timing: toCharacterEngineFeatureTiming(acquisition.timing),
      ...(acquisition.selections ? { selections: acquisition.selections } : {})
    }))

  return [...automaticFeatures, ...explicitFeatures]
}

function inferAutomaticFeatureTiming(
  character: CharacterAuthored,
  source: CharacterProvenance,
  availableAtLevel: number
): CharacterAcquisitionTiming {
  if (source.kind === 'CLASS') {
    return {
      kind: 'CLASS_LEVEL',
      classId: source.classId,
      classLevel: availableAtLevel
    }
  }

  if (source.kind === 'SUBCLASS') {
    const owningClass = character.intent.classes.find((entry) => (
      entry.subclassId === source.subclassId
    ))
    if (owningClass) {
      return {
        kind: 'CLASS_LEVEL',
        classId: owningClass.classId,
        classLevel: availableAtLevel
      }
    }
  }

  return { kind: 'IMMEDIATE' }
}

export function toCharacterEngineFeatureSource(
  source: CharacterProvenance
): EngineFeatureSource {
  return source
}

export function toCharacterEngineFeatureTiming(
  timing: CharacterAcquisitionTiming
): EngineFeatureTiming {
  return timing
}
