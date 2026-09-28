import type { AuthoredPublicationDocument } from '@artificer-toolkit/schema/api/authoredPublication'
import type { CharacterBuilderFeatureSourceHint } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import type { CharacterRuleContextReaders } from './contextPreparation.js'

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

/** Feature ids `prepareCharacterRuleContext` takes from a publication. */
export function publicationFeatureIds(published: AuthoredPublicationDocument): Set<string> {
  const { document } = published
  const features = 'features' in document ? (document.features ?? []) : []
  const ancestry =
    published.subjectKind === 'RACE' && published.document.category === 'BASE'
      ? (published.document.ancestry?.options.flatMap((option) => option.features ?? []) ?? [])
      : []
  return new Set([...features, ...ancestry].map((feature) => feature.id))
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
      if (needed.has(featureId) && (current === undefined || published.document.id < current))
        rootByFeature.set(featureId, published.document.id)
    }
  }
  return [...rootByFeature]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([featureId, rootId]) => ({ featureId, rootId }))
}
