import type { CharacterBuilderFeatureSourceHint } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type { CompiledFeature } from '@artificer-toolkit/shared/compilers'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { hydrateStoredCompilation } from '../authoredPublicationHydrate.js'
import type { CharacterRuleContextReaders, CharacterRulePublication } from './contextPreparation.js'

type FeatureProvenance = CharacterAuthored['intent']['featureAcquisitions'][number]['source']

/**
 * The root a feature acquisition's provenance names (ADR 0036 S7); `OPTION` follows its parent
 * acquisition. `MANUAL`, `FEATURE` and `ANCESTRY` name none, so commit needs a source hint.
 */
export function characterFeatureProvenanceRootId(
  character: CharacterAuthored,
  source: FeatureProvenance,
  visited: ReadonlySet<string> = new Set()
): string | undefined {
  switch (source.kind) {
    case 'CLASS':
      return source.classId
    case 'SUBCLASS':
      return source.subclassId
    case 'RACE':
      return source.raceId
    case 'SUBRACE':
      return source.subraceId
    case 'BACKGROUND':
      return source.backgroundId
    case 'FEAT':
      return source.featId
    case 'OPTION': {
      if (visited.has(source.acquiredParentId)) return undefined
      const parent = character.intent.featureAcquisitions.find(
        (acquisition) => acquisition.id === source.acquiredParentId
      )
      return parent
        ? characterFeatureProvenanceRootId(
            character,
            parent.source,
            new Set([...visited, source.acquiredParentId])
          )
        : undefined
    }
    default:
      return undefined
  }
}

/**
 * The compiled Features a publication holds, ancestry options included. A subrace holds only its
 * own: its compilation also carries the parent's, which the selected parent race contributes.
 */
export function publicationFeatures(
  published: Pick<CharacterRulePublication, 'subjectKind' | 'id' | 'checksum' | 'compilation'>
): CompiledFeature[] {
  const compiled = hydrateStoredCompilation(published.subjectKind, published, published.compilation)
  if (published.subjectKind === 'RACE' && 'parentRaceId' in compiled) {
    const inherited = new Set(compiled.inheritedFeatureIds)
    return (compiled.features ?? []).filter((feature) => !inherited.has(feature.id))
  }
  return [
    ...(('features' in compiled ? compiled.features : undefined) ?? []),
    ...(('ancestry' in compiled ? compiled.ancestry?.options : undefined) ?? []).flatMap(
      (option) => option.features ?? []
    )
  ]
}

/** Feature ids `prepareCharacterRuleContext` takes from a publication. */
export function publicationFeatureIds(
  published: Parameters<typeof publicationFeatures>[0]
): Set<string> {
  return new Set(publicationFeatures(published).map((feature) => feature.id))
}

/**
 * The commit hints for acquisitions whose provenance names no root: each feature's holding root,
 * found by the readers' feature scan. Where several roots hold one feature, the least root id wins,
 * so browser and server readers agree whatever order they scan in.
 */
export async function collectCharacterFeatureSourceHints(
  character: CharacterAuthored,
  readers: Pick<CharacterRuleContextReaders, 'readFeatureSources'>
): Promise<CharacterBuilderFeatureSourceHint[]> {
  // As commit does: a feature needs a hint only when none of its acquisitions names a root.
  const acquisitions = character.intent.featureAcquisitions
  const needed = new Set(
    acquisitions
      .map((acquisition) => acquisition.featureId)
      .filter((featureId) =>
        acquisitions.every(
          (acquisition) =>
            acquisition.featureId !== featureId ||
            !characterFeatureProvenanceRootId(character, acquisition.source)
        )
      )
  )
  if (needed.size === 0) return []
  const rootByFeature = new Map<string, string>()
  for (const published of await readers.readFeatureSources(needed)) {
    for (const featureId of publicationFeatureIds(published)) {
      const current = rootByFeature.get(featureId)
      if (needed.has(featureId) && (current === undefined || published.id < current))
        rootByFeature.set(featureId, published.id)
    }
  }
  return [...rootByFeature]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([featureId, rootId]) => ({ featureId, rootId }))
}
