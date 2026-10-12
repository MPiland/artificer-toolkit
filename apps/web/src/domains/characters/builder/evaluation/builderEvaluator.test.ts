// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { ContentSnapshotKind } from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  previewSnapshotCharacterBuilder,
  resolveSnapshotCharacterBuilderPayload
} from '@artificer-toolkit/rules-runtime/character/snapshotBuilderEvaluation'
import { createSnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { elf, highElf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { dragonborn } from '@artificer-toolkit/source-data/srd/races/dragonborn.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { ContentSnapshotStore } from '#app/data/contentSnapshots/contentSnapshotStore'
import type { ContentSnapshotLocation } from '#app/data/contentSnapshots/manifestObjects'
import {
  createFallbackCharacterFormValues,
  normalizeCharacterForDraft
} from '../shared/formNormalization'
import type { BuilderEvaluationRequest } from './builderEvaluation.types'
import { createBuilderEvaluator } from './builderEvaluator'
import {
  createSnapshotStore,
  readySrdCharacterIntent,
  readySrdSnapshot,
  SRD_SNAPSHOT_KINDS,
  srdSnapshot
} from './builderSnapshot.fixtures'

// ADR 0036 S6. `builderSnapshotParity.test.ts` (apps/apis) proves the snapshot evaluation equals
// a pure full-pool evaluation over the S5 corpus; this proves the worker's manifest,
// store and lazy loading add nothing to it.

const USER_ID = '00000000-0000-4000-8000-000000000901'
const { objects, manifest } = srdSnapshot

function fakeStore(failingKind?: ContentSnapshotKind) {
  const reads: ContentSnapshotLocation['header'][] = []
  const source = createSnapshotStore(objects, failingKind)
  const store: ContentSnapshotStore = {
    read: vi.fn(async (location: ContentSnapshotLocation) => {
      reads.push(location.header)
      return source.read(location)
    }),
    retain: vi.fn(source.retain)
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
// Spell documents are read only for the Spells a Character names (ADR 0036), so the Wizard names one.
const wizardCantrip = srdSpells.find(
  (spell) => spell.level === 0 && spell.classIds?.includes(wizard.id)
)
if (!wizardCantrip) throw new Error('Expected a SRD Wizard cantrip.')
const wizardIntent = {
  race: { raceId: elf.id, subraceId: highElf.id },
  classes: [{ classId: wizard.id, classLevel: 1 }],
  spellSelections: [
    {
      id: '00000000-0000-4000-8000-000000000904',
      source: { kind: 'CLASS' as const, classId: wizard.id, classLevel: 1 },
      timing: { kind: 'IMMEDIATE' as const },
      spells: [wizardCantrip.id]
    }
  ]
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
          ),
          featureSourceHints: []
        }
      })
    }
  })

  it('names the root of each MANUAL, FEATURE and ANCESTRY acquisition for commit (S7)', async () => {
    const { store } = fakeStore()
    const evaluate = createBuilderEvaluator({ store, onLoading: () => undefined })
    const ancestry = dragonborn.category === 'BASE' ? dragonborn.ancestry : undefined
    const option = ancestry?.options[0]
    const ancestryFeature = option?.features?.[0]
    const [manualFeature, featureGranted] = wizard.features ?? []
    const fighterFeature = fighter.features?.find((feature) => feature.availableAtLevel === 1)
    if (
      !ancestry ||
      !option ||
      !ancestryFeature ||
      !manualFeature ||
      !featureGranted ||
      !fighterFeature
    )
      throw new Error('Expected SRD feature fixtures.')
    const acquisition = (
      featureId: string,
      source: CharacterAuthored['intent']['featureAcquisitions'][number]['source']
    ) => ({
      id: crypto.randomUUID(),
      featureId,
      source,
      timing: { kind: 'IMMEDIATE' as const }
    })
    const intent = {
      race: { raceId: dragonborn.id },
      background: { backgroundId: acolyte.id },
      classes: [{ classId: fighter.id, classLevel: 1 }],
      ancestrySelections: [
        {
          id: crypto.randomUUID(),
          ancestryId: ancestry.id,
          optionId: option.id,
          source: { kind: 'RACE' as const, raceId: dragonborn.id },
          timing: { kind: 'IMMEDIATE' as const }
        }
      ],
      featureAcquisitions: [
        acquisition(manualFeature.id, { kind: 'MANUAL' }),
        acquisition(featureGranted.id, { kind: 'FEATURE', featureId: fighterFeature.id }),
        acquisition(ancestryFeature.id, {
          kind: 'ANCESTRY',
          ancestryId: ancestry.id,
          optionId: option.id
        })
      ]
    }

    const previewed = await evaluate(request('preview', intent))
    if (!previewed.ok || previewed.output.operation !== 'preview')
      throw new Error('Expected a preview.')
    // Reconciliation keeps all three acquisitions, so commit sends a root for each.
    expect(previewed.output.preview.character.intent.featureAcquisitions).toHaveLength(3)
    expect(previewed.output.featureSourceHints).toEqual(
      [
        { featureId: manualFeature.id, rootId: wizard.id },
        { featureId: featureGranted.id, rootId: wizard.id },
        { featureId: ancestryFeature.id, rootId: dragonborn.id }
      ].sort((left, right) => left.featureId.localeCompare(right.featureId))
    )
  })

  it('reads every index first, documents only per needed kind, and each object once', async () => {
    const { store, reads } = fakeStore()
    const evaluate = createBuilderEvaluator({ store, onLoading: () => undefined })

    await evaluate(request('resolve', fighterIntent))
    expect(
      reads.slice(0, SRD_SNAPSHOT_KINDS.length).every((header) => header.part === 'index')
    ).toBe(true)
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

  it('resolves the ready fixture Character as ready and previews it for finalization', async () => {
    const evaluate = createBuilderEvaluator({
      store: createSnapshotStore(readySrdSnapshot.objects),
      onLoading: () => undefined
    })
    const ready = (operation: BuilderEvaluationRequest['operation']) => ({
      ...request(operation, readySrdCharacterIntent),
      manifest: readySrdSnapshot.manifest
    })

    const resolved = await evaluate(ready('resolve'))
    if (!resolved.ok || resolved.output.operation !== 'resolve')
      throw new Error('Expected a resolution.')
    expect(resolved.output.payload.view.review).toEqual({ blockers: [], warnings: [], ready: true })

    const previewed = await evaluate(ready('preview'))
    if (!previewed.ok || previewed.output.operation !== 'preview')
      throw new Error('Expected a preview.')
    expect(previewed.output.preview.character.label).toBe('Snapshot hero')
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
