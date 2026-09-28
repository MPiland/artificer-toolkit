// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type {
  ContentSnapshotHead,
  ContentSnapshotKind,
  ContentSnapshotManifestDto,
  ContentSnapshotObject
} from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  previewSnapshotCharacterBuilder,
  resolveSnapshotCharacterBuilderPayload
} from '@artificer-toolkit/rules-runtime/character/snapshotBuilderEvaluation'
import { createSnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import {
  buildContentSnapshotKind,
  type ContentSnapshotIndexSource
} from '@artificer-toolkit/rules-runtime/contentSnapshots'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'
import { elf, highElf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  ContentSnapshotLoadError,
  type ContentSnapshotStore
} from '#app/data/contentSnapshots/contentSnapshotStore'
import type { ContentSnapshotLocation } from '#app/data/contentSnapshots/manifestObjects'
import {
  createFallbackCharacterFormValues,
  normalizeCharacterForDraft
} from '../shared/formNormalization'
import type { BuilderEvaluationRequest } from './builderEvaluation.types'
import { createBuilderEvaluator } from './builderEvaluator'

// ADR 0036 S6. `builderSnapshotParity.test.ts` (apps/apis) proves the snapshot evaluation equals
// `builder.resolve` and `builder.preview` over the S5 corpus; this proves the worker's manifest,
// store and lazy loading add nothing to it.

const KINDS = ['RACE', 'CLASS', 'BACKGROUND', 'FEAT', 'SPELL'] as const
const USER_ID = '00000000-0000-4000-8000-000000000901'
const srd = prepareSrdImport()

const objects: ContentSnapshotObject[] = []
const kinds: ContentSnapshotHead['kinds'] = {}
for (const kind of KINDS) {
  // The import manifest already validated each document against its publication schema.
  const sources = srd.subjects
    .filter((subject) => subject.subjectKind === kind)
    .map(
      (subject) =>
        ({ subjectKind: kind, document: subject.document }) as unknown as ContentSnapshotIndexSource
    )
  const built = buildContentSnapshotKind(
    { format: 1, scope: 'SOURCE', scopeId: SRD_CONTENT_SOURCE.id, kind },
    sources
  )
  const ref = (part: { sha256: string; byteLength: number; rootCount: number }) => ({
    sha256: part.sha256,
    byteLength: part.byteLength,
    rootCount: part.rootCount
  })
  kinds[kind] = { index: ref(built.index), documents: ref(built.documents) }
  objects.push(
    JSON.parse(built.index.json) as ContentSnapshotObject,
    JSON.parse(built.documents.json) as ContentSnapshotObject
  )
}
const manifest: ContentSnapshotManifestDto = {
  systemId: srdSystemRecord.id,
  sources: [
    {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      kind: 'PLATFORM',
      head: {
        scope: 'SOURCE',
        scopeId: SRD_CONTENT_SOURCE.id,
        revision: 1,
        builtRevision: 1,
        kinds
      }
    }
  ],
  campaign: null
}

function fakeStore(failingKind?: ContentSnapshotKind) {
  const reads: ContentSnapshotLocation['header'][] = []
  const store: ContentSnapshotStore = {
    read: vi.fn(async (location: ContentSnapshotLocation) => {
      reads.push(location.header)
      if (location.header.kind === failingKind && location.header.part === 'documents')
        throw new ContentSnapshotLoadError(failingKind, 'Content request failed with status 503.')
      const object = objects.find(
        (candidate) =>
          candidate.kind === location.header.kind && candidate.part === location.header.part
      )
      if (!object) throw new Error('Unexpected object.')
      return object
    }),
    retain: vi.fn(async () => undefined)
  }
  return { store, reads }
}

function request(
  operation: BuilderEvaluationRequest['operation'],
  intent: Partial<CharacterAuthored['intent']>
): BuilderEvaluationRequest {
  const values = createFallbackCharacterFormValues(srdSystemRecord.id)
  return {
    operation,
    manifest,
    system: srdSystemRecord,
    draft: {
      expectedDraftId: '00000000-0000-4000-8000-000000000903',
      mode: 'create',
      userId: USER_ID,
      publicId: 'snapshot-hero',
      baseActiveUpdatedAt: null
    },
    character: normalizeCharacterForDraft({
      ...values,
      id: '00000000-0000-4000-8000-000000000902',
      label: 'Snapshot hero',
      userId: USER_ID,
      intent: { ...values.intent, ...intent }
    }),
    previousCharacter: null
  }
}

/** The S5-proven path: every object up front, no worker, store or manifest. */
function eagerInput(evaluation: BuilderEvaluationRequest) {
  return {
    character: { ...evaluation.character, userId: USER_ID, status: 'DRAFT' } as CharacterAuthored,
    previousCharacter: null,
    mode: 'create' as const,
    system: srdSystemRecord,
    publicId: 'snapshot-hero',
    baseActiveUpdatedAt: null,
    contentMaturity: null
  }
}

const fighterIntent = {
  race: { raceId: human.id },
  background: { backgroundId: acolyte.id },
  classes: [{ classId: fighter.id, classLevel: 1 }]
}
const wizardIntent = {
  race: { raceId: elf.id, subraceId: highElf.id },
  classes: [{ classId: wizard.id, classLevel: 1 }]
}

describe('Builder worker evaluation', () => {
  it('resolves and previews exactly as the snapshot evaluation does', async () => {
    const { store } = fakeStore()
    const evaluate = createBuilderEvaluator({ store, onLoading: () => undefined })
    const eager = createSnapshotReaders(objects)

    for (const intent of [fighterIntent, wizardIntent]) {
      const resolved = await evaluate(request('resolve', intent))
      expect(resolved).toEqual({
        ok: true,
        output: {
          operation: 'resolve',
          payload: await resolveSnapshotCharacterBuilderPayload(
            eagerInput(request('resolve', intent)),
            eager
          )
        }
      })
      const previewed = await evaluate(request('preview', intent))
      expect(previewed).toEqual({
        ok: true,
        output: {
          operation: 'preview',
          preview: await previewSnapshotCharacterBuilder(
            eagerInput(request('preview', intent)),
            eager
          )
        }
      })
    }
  })

  it('reads every index first, documents only per needed kind, and each object once', async () => {
    const { store, reads } = fakeStore()
    const evaluate = createBuilderEvaluator({ store, onLoading: () => undefined })

    await evaluate(request('resolve', fighterIntent))
    expect(reads.slice(0, KINDS.length).every((header) => header.part === 'index')).toBe(true)
    expect(
      reads.filter((header) => header.part === 'documents').map((header) => header.kind)
    ).toEqual(expect.not.arrayContaining(['SPELL']))

    await evaluate(request('resolve', wizardIntent))
    await evaluate(request('resolve', wizardIntent))
    const documentReads = reads.filter((header) => header.part === 'documents')
    expect(documentReads.map((header) => header.kind)).toContain('SPELL')
    expect(new Set(documentReads.map((header) => header.kind)).size).toBe(documentReads.length)
    expect(store.retain).toHaveBeenCalledTimes(1)
  })

  it('names the kind that failed to load and reports loading kinds', async () => {
    const { store } = fakeStore('SPELL')
    const loading: ContentSnapshotKind[][] = []
    const evaluate = createBuilderEvaluator({ store, onLoading: (kinds) => loading.push(kinds) })

    await expect(evaluate(request('resolve', wizardIntent))).resolves.toEqual({
      ok: false,
      failedKind: 'SPELL'
    })
    expect(loading).toContainEqual(['SPELL'])
    expect(loading.at(-1)).toEqual([])
  })
})
