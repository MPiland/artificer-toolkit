import type {
  AuthoredPublicationDocument,
  AuthoredStoredCompilation
} from '@artificer-toolkit/schema/api/authoredPublication'
import type {
  ContentSnapshotIndexEntry,
  ContentSnapshotIndexObject,
  ContentSnapshotKind,
  ContentSnapshotObject
} from '@artificer-toolkit/schema/api/contentSnapshots'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type {
  BaseRaceAuthoredDto,
  SubraceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'

import { joinRaceCatalogSource } from './builderCatalog.js'
import {
  toCharacterRulePublication,
  type CharacterBuilderCatalogueReaders,
  type CharacterRuleContextReaders,
  type CharacterRulePublication,
  type CharacterRuleSpellPublication
} from './contextPreparation.js'

// The kinds whose roots carry features, in the order the Convex feature scan reads them.
const FEATURE_SOURCE_KINDS = [
  'BACKGROUND',
  'CLASS',
  'CREATURE',
  'EQUIPMENT',
  'FEAT',
  'RACE',
  'VEHICLE'
] as const satisfies readonly ContentSnapshotKind[]

/**
 * Builder readers over the content snapshot objects of one Character's manifest: its SOURCE scopes
 * and its Campaign scope (ADR 0036, D67). The caller supplies every kind the Builder reads, so each
 * pool is complete. Roots merge by id, and a SOURCE object shadows a CAMPAIGN share of the same
 * root, as the Convex source reads do. Vocabulary labels resolve later through the System passed to
 * `prepareCharacterRuleContext`.
 */
export function createSnapshotReaders(
  objects: readonly ContentSnapshotObject[]
): CharacterRuleContextReaders & CharacterBuilderCatalogueReaders {
  const ordered = [...objects].sort(
    (left, right) => Number(left.scope === 'CAMPAIGN') - Number(right.scope === 'CAMPAIGN')
  )
  // A root with the version identity and stored compilation its documents object pairs with it.
  type SnapshotRoot = {
    published: AuthoredPublicationDocument
    checksum: string
    compilation: AuthoredStoredCompilation
  }
  const publications = new Map<string, SnapshotRoot>()
  const publicationsByKind = new Map<ContentSnapshotKind, SnapshotRoot[]>()
  for (const object of ordered) {
    if (object.part !== 'documents') continue
    const ofKind = publicationsByKind.get(object.kind) ?? []
    publicationsByKind.set(object.kind, ofKind)
    object.roots.forEach((document, index) => {
      if (publications.has(document.id)) return
      const root = {
        // `kind` discriminates `roots`; TypeScript cannot correlate the pair it builds.
        published: { subjectKind: object.kind, document } as AuthoredPublicationDocument,
        // The documents schema aligns versions and compilations with roots by index.
        checksum: object.versions[index]!.identity.checksum,
        compilation: object.compilations[index]!
      }
      publications.set(document.id, root)
      ofKind.push(root)
    })
  }

  // The picker kinds the Builder reads from the index part.
  const index = {
    RACE: new Map<string, ContentSnapshotIndexEntry<'RACE'>>(),
    CLASS: new Map<string, ContentSnapshotIndexEntry<'CLASS'>>(),
    BACKGROUND: new Map<string, ContentSnapshotIndexEntry<'BACKGROUND'>>(),
    EQUIPMENT: new Map<string, ContentSnapshotIndexEntry<'EQUIPMENT'>>(),
    FEAT: new Map<string, ContentSnapshotIndexEntry<'FEAT'>>(),
    SPELL: new Map<string, ContentSnapshotIndexEntry<'SPELL'>>()
  }
  function addEntries<Entry extends { id: string }>(
    entries: Map<string, Entry>,
    roots: readonly Entry[]
  ) {
    for (const entry of roots) if (!entries.has(entry.id)) entries.set(entry.id, entry)
  }
  for (const object of ordered.filter(
    (object): object is ContentSnapshotIndexObject => object.part === 'index'
  )) {
    switch (object.kind) {
      case 'RACE':
        addEntries(index.RACE, object.roots)
        break
      case 'CLASS':
        addEntries(index.CLASS, object.roots)
        break
      case 'BACKGROUND':
        addEntries(index.BACKGROUND, object.roots)
        break
      case 'EQUIPMENT':
        addEntries(index.EQUIPMENT, object.roots)
        break
      case 'FEAT':
        addEntries(index.FEAT, object.roots)
        break
      case 'SPELL':
        addEntries(index.SPELL, object.roots)
        break
    }
  }

  function baseRaceOf(document: SubraceAuthoredDto): BaseRaceAuthoredDto {
    const parent = publications.get(document.parentRaceId)?.published
    if (
      document.parentRaceId === document.id ||
      parent?.subjectKind !== 'RACE' ||
      parent.document.category !== 'BASE'
    )
      throw new Error('A readable base Race in the same System is required.')
    return parent.document
  }
  function equipmentAncestors(document: EquipmentAuthoredDto) {
    const ancestors = new Map<string, EquipmentAuthoredDto>([[document.id, document]])
    for (let current = document; current.category === 'VARIANT';) {
      const parentId = current.parentEquipmentId
      if (ancestors.has(parentId)) throw new Error('Equipment variant cycle detected.')
      if (ancestors.size >= 500)
        throw new Error('Equipment inheritance exceeds the authoring limit.')
      const parent = publications.get(parentId)?.published
      if (parent?.subjectKind !== 'EQUIPMENT')
        throw new Error('Readable parent Equipment in the same System is required.')
      ancestors.set(parent.document.id, parent.document)
      current = parent.document
    }
    return ancestors
  }
  // A snapshot carries every document, so its publications carry their presentation; a subrace,
  // subclass or variant is readable only with its parent chain.
  function toPublication({ published, ...stored }: SnapshotRoot): CharacterRulePublication {
    const { document } = published
    if (published.subjectKind === 'CLASS' && published.document.category === 'SUBCLASS') {
      const { parentClassId } = published.document
      const parent = publications.get(parentClassId)?.published
      if (
        parentClassId === document.id ||
        parent?.subjectKind !== 'CLASS' ||
        parent.document.category !== 'BASE'
      )
        throw new Error('A readable base class in the same System is required.')
    }
    return toCharacterRulePublication(
      published,
      stored,
      {
        race:
          published.subjectKind === 'RACE' && published.document.category === 'SUBRACE'
            ? baseRaceOf(published.document)
            : undefined,
        equipment:
          published.subjectKind === 'EQUIPMENT' ? equipmentAncestors(published.document) : undefined
      },
      true
    )
  }

  return {
    readPublication: async (id) => {
      const root = publications.get(id)
      return root ? toPublication(root) : null
    },
    readFeatureSources: async (missingFeatureIds) =>
      FEATURE_SOURCE_KINDS.flatMap((kind) =>
        (publicationsByKind.get(kind) ?? []).flatMap((root) => {
          const { published } = root
          const features = [
            ...('features' in published.document ? (published.document.features ?? []) : []),
            ...(published.subjectKind === 'RACE' && published.document.category === 'BASE'
              ? (published.document.ancestry?.options.flatMap((option) => option.features ?? []) ??
                [])
              : [])
          ]
          return features.some((feature) => missingFeatureIds.has(feature.id))
            ? [toPublication(root)]
            : []
        })
      ),
    readSpellCatalogue: async (referencedSpellIds) => ({
      entries: [...index.SPELL.values()],
      publications: (publicationsByKind.get('SPELL') ?? []).flatMap(
        (root): CharacterRuleSpellPublication[] => {
          if (!referencedSpellIds.has(root.published.document.id)) return []
          const spell = toPublication(root)
          return spell.subjectKind === 'SPELL' ? [spell] : []
        }
      )
    }),
    readRaces: async () =>
      [...index.RACE.values()].map((race) =>
        joinRaceCatalogSource(
          race,
          race.category === 'SUBRACE' ? index.RACE.get(race.parentRaceId) : undefined
        )
      ),
    readClasses: async () => [...index.CLASS.values()],
    readBackgrounds: async () => [...index.BACKGROUND.values()],
    readEquipment: async () => ({ entries: [...index.EQUIPMENT.values()] }),
    readFeats: async () => [...index.FEAT.values()].map(({ id, label }) => ({ id, label }))
  }
}

type SnapshotReaders = ReturnType<typeof createSnapshotReaders>

/**
 * `createSnapshotReaders` over every kind's `index` objects, loading a kind's `documents` objects
 * only when a read needs them (ADR 0036 S6). The index names every root's kind, so a publication
 * read loads only that kind; the feature scan loads every feature-bearing kind. `loadDocuments`
 * returns the documents objects of the given kinds across the manifest's scopes.
 */
export function createLazySnapshotReaders(
  indexObjects: readonly ContentSnapshotIndexObject[],
  loadDocuments: (
    kinds: readonly ContentSnapshotKind[]
  ) => Promise<readonly ContentSnapshotObject[]>
): SnapshotReaders {
  const kindById = new Map<string, ContentSnapshotKind>()
  for (const object of indexObjects)
    for (const root of object.roots) if (!kindById.has(root.id)) kindById.set(root.id, object.kind)
  // One load per kind, shared by concurrent reads; a failed load is retried by the next read.
  const loads = new Map<ContentSnapshotKind, Promise<void>>()
  let objects: readonly ContentSnapshotObject[] = indexObjects
  let readers = createSnapshotReaders(objects)
  async function withDocuments(kinds: readonly ContentSnapshotKind[]) {
    const missing = kinds.filter((kind) => !loads.has(kind))
    if (missing.length > 0) {
      const load = loadDocuments(missing).then((documents) => {
        objects = [...objects, ...documents]
        readers = createSnapshotReaders(objects)
      })
      for (const kind of missing) loads.set(kind, load)
      load.catch(() => {
        for (const kind of missing) loads.delete(kind)
      })
    }
    await Promise.all(kinds.map((kind) => loads.get(kind)))
    return readers
  }

  return {
    readPublication: async (id) => {
      const kind = kindById.get(id)
      return kind ? (await withDocuments([kind])).readPublication(id) : null
    },
    readFeatureSources: async (missingFeatureIds) =>
      (await withDocuments(FEATURE_SOURCE_KINDS)).readFeatureSources(missingFeatureIds),
    readSpellCatalogue: async (referencedSpellIds, classSpellLists) =>
      (referencedSpellIds.size ? await withDocuments(['SPELL']) : readers).readSpellCatalogue(
        referencedSpellIds,
        classSpellLists
      ),
    readRaces: () => readers.readRaces(),
    readClasses: () => readers.readClasses(),
    readBackgrounds: () => readers.readBackgrounds(),
    readEquipment: () => readers.readEquipment(),
    readFeats: () => readers.readFeats()
  }
}
