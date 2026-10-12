import type {
  ContentSnapshotHead,
  ContentSnapshotKind,
  ContentSnapshotManifestDto,
  ContentSnapshotObject
} from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  buildContentSnapshotKind,
  type ContentSnapshotListSource
} from '@artificer-toolkit/rules-runtime/contentSnapshots'
import {
  CharacterStartingEquipmentSource,
  type CharacterAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  ContentSnapshotLoadError,
  type ContentSnapshotStore
} from '#app/data/contentSnapshots/contentSnapshotStore'
import type { ContentSnapshotLocation } from '#app/data/contentSnapshots/manifestObjects'

/** The kinds the Builder reads from content snapshots (ADR 0036). */
export const SRD_SNAPSHOT_KINDS = ['RACE', 'CLASS', 'BACKGROUND', 'FEAT', 'SPELL'] as const

if (fighter.category !== 'BASE') throw new Error('Expected the canonical parent Fighter class.')

const srd = prepareSrdImport()

/** The parts of a publication document the snapshot builder reads. */
type SrdDocument = {
  id: string
  parentRaceId?: string
  parentClassId?: string
  [field: string]: unknown
}

const ref = (part: { sha256: string; byteLength: number; rootCount: number }) => ({
  sha256: part.sha256,
  byteLength: part.byteLength,
  rootCount: part.rootCount
})

/** Builds the SRD snapshot objects and the manifest naming them as one platform source. */
function buildSrdSnapshot(documentOverrides: ReadonlyMap<string, SrdDocument>) {
  const objects: ContentSnapshotObject[] = []
  const kinds: ContentSnapshotHead['kinds'] = {}
  for (const kind of SRD_SNAPSHOT_KINDS) {
    // The import manifest already validated each document against its publication schema.
    const sources = srd.subjects
      .filter((subject) => subject.subjectKind === kind)
      .map((subject) => {
        const document = documentOverrides.get(subject.id) ?? (subject.document as SrdDocument)
        return {
          subjectKind: kind,
          document,
          publicId: document.id,
          publicationVersion: {
            identity: {
              subjectKind: kind,
              subjectId: subject.id,
              systemId: subject.systemId,
              contentSourceId: SRD_CONTENT_SOURCE.id,
              versionId: subject.id,
              checksum: subject.checksum
            },
            version: 1,
            storedParentId: document.parentRaceId ?? document.parentClassId ?? null
          },
          magicSchoolLabel: 'School'
        } as unknown as ContentSnapshotListSource
      })
    const built = buildContentSnapshotKind(
      { format: 2, scope: 'SOURCE', scopeId: SRD_CONTENT_SOURCE.id, kind },
      sources
    )
    kinds[kind] = {
      index: ref(built.index),
      list: ref(built.list),
      documents: ref(built.documents)
    }
    objects.push(
      JSON.parse(built.index.json) as ContentSnapshotObject,
      JSON.parse(built.list.json) as ContentSnapshotObject,
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
  return { objects, manifest }
}

/** Every SRD index, list and documents object, as the content Worker serves them. */
export const srdSnapshot = buildSrdSnapshot(new Map())

/**
 * The SRD snapshot with the Human, Fighter and Acolyte documents stripped of the choices the
 * Builder would ask a player to make (features, proficiencies, starting equipment sets), so a
 * Character built from them resolves ready without hand-writing every choice.
 */
export const readySrdSnapshot = buildSrdSnapshot(
  new Map<string, SrdDocument>([
    [human.id, { ...human, features: [] }],
    [
      fighter.id,
      {
        ...fighter,
        features: [],
        proficiencies: [],
        startingEquipment: fighter.startingEquipment && { ...fighter.startingEquipment, sets: [] }
      }
    ],
    [
      acolyte.id,
      {
        ...acolyte,
        features: [],
        proficiencies: [],
        startingEquipment: acolyte.startingEquipment && { ...acolyte.startingEquipment, sets: [] }
      }
    ]
  ])
)

/** The intent that resolves ready over `readySrdSnapshot`: a level 1 Human Fighter, Acolyte, taking gold. */
export const readySrdCharacterIntent = {
  race: { raceId: human.id },
  background: { backgroundId: acolyte.id },
  classes: [{ classId: fighter.id, classLevel: 1 }],
  abilities: {
    method: 'STANDARD_ARRAY',
    assignments: [
      { ability: 'STRENGTH', option: '15' },
      { ability: 'DEXTERITY', option: '14' },
      { ability: 'CONSTITUTION', option: '13' },
      { ability: 'INTELLIGENCE', option: '12' },
      { ability: 'WISDOM', option: '10' },
      { ability: 'CHARISMA', option: '8' }
    ]
  },
  hitpoints: {
    method: 'FIXED',
    levels: [{ level: 1, classId: fighter.id, classLevel: 1, value: 10 }]
  },
  startingEquipment: {
    class: {
      source: CharacterStartingEquipmentSource.CLASS,
      tookGold: true,
      gold: { goldOption: fighter.startingGold.dieConfig, totalGold: 100 },
      applied: true
    }
  }
} satisfies Partial<CharacterAuthored['intent']>

/** A store over snapshot objects; reading a documents object of `failingKind` fails as a 503 would. */
export function createSnapshotStore(
  objects: readonly ContentSnapshotObject[],
  failingKind?: ContentSnapshotKind
): ContentSnapshotStore {
  return {
    read: async (location: ContentSnapshotLocation) => {
      if (location.header.kind === failingKind && location.header.part === 'documents')
        throw new ContentSnapshotLoadError(failingKind, 'Content request failed with status 503.')
      const object = objects.find(
        (candidate) =>
          candidate.kind === location.header.kind && candidate.part === location.header.part
      )
      if (!object) throw new Error('Unexpected object.')
      return object
    },
    retain: async () => undefined
  }
}
