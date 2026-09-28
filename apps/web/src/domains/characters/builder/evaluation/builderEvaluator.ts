import { characterBuilderResolveInputSchema } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type {
  ContentSnapshotIndexObject,
  ContentSnapshotKind,
  ContentSnapshotObject
} from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  previewSnapshotCharacterBuilder,
  resolveSnapshotCharacterBuilderPayload,
  type SnapshotCharacterBuilderInput
} from '@artificer-toolkit/rules-runtime/character/snapshotBuilderEvaluation'
import { collectCharacterFeatureSourceHints } from '@artificer-toolkit/rules-runtime/character/featureSourceHints'
import { createLazySnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  ContentSnapshotLoadError,
  type ContentSnapshotStore
} from '#app/data/contentSnapshots/contentSnapshotStore'
import {
  listContentSnapshotManifestObjects,
  type ContentSnapshotLocation
} from '#app/data/contentSnapshots/manifestObjects'
import type { BuilderEvaluationRequest, BuilderEvaluationResult } from './builderEvaluation.types'

/** The server's view of the candidate: parsed as `builder.resolve` args, owned and a draft. */
function toSnapshotInput(request: BuilderEvaluationRequest): SnapshotCharacterBuilderInput {
  const { draft } = request
  // Convex transport drops undefined fields before the server parses its args.
  const { character } = characterBuilderResolveInputSchema.parse(
    JSON.parse(
      JSON.stringify({
        character: request.character,
        mode: draft.mode,
        expectedDraftId: draft.expectedDraftId
      })
    )
  )
  return {
    // Validated Character DTOs use literal starting-equipment sources for the authored string enum.
    character: { ...character, userId: draft.userId, status: 'DRAFT' } as CharacterAuthored,
    previousCharacter: request.previousCharacter as CharacterAuthored | null,
    mode: draft.mode,
    system: request.system,
    builderIntent: draft.builderIntent,
    publicId: draft.publicId,
    baseActiveUpdatedAt: draft.baseActiveUpdatedAt,
    contentMaturity: request.manifest.campaign?.contentMaturity ?? null
  }
}

const isIndexObject = (object: ContentSnapshotObject): object is ContentSnapshotIndexObject =>
  object.part === 'index'

/**
 * Evaluates Builder requests over one manifest's snapshot objects (ADR 0036 S6). Readers, and the
 * documents they have loaded, are kept while the manifest's object hashes are unchanged; a new
 * manifest drops the objects it no longer names. `onLoading` reports the kinds being fetched.
 */
export function createBuilderEvaluator(options: {
  store: ContentSnapshotStore
  onLoading: (kinds: ContentSnapshotKind[]) => void
}) {
  const loading = new Map<ContentSnapshotKind, number>()
  async function track<T>(kinds: readonly ContentSnapshotKind[], work: () => Promise<T>) {
    for (const kind of kinds) loading.set(kind, (loading.get(kind) ?? 0) + 1)
    options.onLoading([...loading.keys()])
    try {
      return await work()
    } finally {
      for (const kind of kinds) {
        const count = (loading.get(kind) ?? 1) - 1
        if (count === 0) loading.delete(kind)
        else loading.set(kind, count)
      }
      options.onLoading([...loading.keys()])
    }
  }
  const read = (locations: readonly ContentSnapshotLocation[]) =>
    track([...new Set(locations.map((location) => location.header.kind))], () =>
      Promise.all(locations.map((location) => options.store.read(location)))
    )

  let current: {
    key: string
    readers: Promise<ReturnType<typeof createLazySnapshotReaders>>
  } | null = null
  function readersFor(manifest: BuilderEvaluationRequest['manifest']) {
    const locations = listContentSnapshotManifestObjects(manifest)
    const hashes = locations.map((location) => location.ref.sha256)
    const key = [...hashes].sort().join()
    if (current?.key === key) return current.readers
    // Eviction is housekeeping; a failure only leaves unused objects cached.
    options.store.retain(new Set(hashes)).catch(() => undefined)
    const readers = read(locations.filter((location) => location.header.part === 'index')).then(
      (objects) =>
        createLazySnapshotReaders(objects.filter(isIndexObject), (kinds) =>
          read(
            locations.filter(
              (location) =>
                location.header.part === 'documents' && kinds.includes(location.header.kind)
            )
          )
        )
    )
    current = { key, readers }
    readers.catch(() => {
      if (current?.key === key) current = null
    })
    return readers
  }

  return async function evaluate(
    request: BuilderEvaluationRequest
  ): Promise<BuilderEvaluationResult> {
    try {
      const readers = await readersFor(request.manifest)
      const input = toSnapshotInput(request)
      if (request.operation === 'resolve')
        return {
          ok: true,
          output: {
            operation: 'resolve',
            payload: await resolveSnapshotCharacterBuilderPayload(input, readers)
          }
        }
      const preview = await previewSnapshotCharacterBuilder(input, readers)
      return {
        ok: true,
        output: {
          operation: 'preview',
          preview,
          // Commit sends the previewed Character, so its hints come from that Character.
          featureSourceHints: await collectCharacterFeatureSourceHints(
            preview.character as CharacterAuthored,
            readers
          )
        }
      }
    } catch (error) {
      return {
        ok: false,
        failedKind: error instanceof ContentSnapshotLoadError ? error.kind : null
      }
    }
  }
}
