import type { AuthoredPublicationDocument } from '@artificer-toolkit/schema/api/authoredPublication'
import type {
  ContentSnapshotIndexEntry,
  ContentSnapshotIndexObject,
  ContentSnapshotKind,
  ContentSnapshotObject
} from '@artificer-toolkit/schema/api/contentSnapshots'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'

import type { CharacterBuilderRaceCatalogSource } from './builderCatalog.js'
import type {
  CharacterBuilderCatalogueReaders,
  CharacterRuleContextReaders
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
  const publications = new Map<string, AuthoredPublicationDocument>()
  const publicationsByKind = new Map<ContentSnapshotKind, AuthoredPublicationDocument[]>()
  for (const object of ordered) {
    if (object.part !== 'documents') continue
    const ofKind = publicationsByKind.get(object.kind) ?? []
    publicationsByKind.set(object.kind, ofKind)
    for (const document of object.roots) {
      if (publications.has(document.id)) continue
      // `kind` discriminates `roots`; TypeScript cannot correlate the pair it builds.
      const publication = { subjectKind: object.kind, document } as AuthoredPublicationDocument
      publications.set(document.id, publication)
      ofKind.push(publication)
    }
  }

  // The picker kinds the Builder reads from the index part.
  const index = {
    RACE: new Map<string, ContentSnapshotIndexEntry<'RACE'>>(),
    CLASS: new Map<string, ContentSnapshotIndexEntry<'CLASS'>>(),
    BACKGROUND: new Map<string, ContentSnapshotIndexEntry<'BACKGROUND'>>(),
    EQUIPMENT: new Map<string, ContentSnapshotIndexEntry<'EQUIPMENT'>>(),
    FEAT: new Map<string, ContentSnapshotIndexEntry<'FEAT'>>()
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
    }
  }

  return {
    readPublication: async (id) => publications.get(id) ?? null,
    readRaceParent: async (document) => {
      const parent = publications.get(document.parentRaceId)
      if (
        document.parentRaceId === document.id ||
        parent?.subjectKind !== 'RACE' ||
        parent.document.category !== 'BASE'
      )
        throw new Error('A readable base Race in the same System is required.')
      return parent.document
    },
    requireClassParent: async (document) => {
      const parent = publications.get(document.parentClassId)
      if (
        document.parentClassId === document.id ||
        parent?.subjectKind !== 'CLASS' ||
        parent.document.category !== 'BASE'
      )
        throw new Error('A readable base class in the same System is required.')
    },
    readEquipmentParents: async (document) => {
      const ancestors = new Map<string, EquipmentAuthoredDto>([[document.id, document]])
      for (let current = document; current.category === 'VARIANT'; ) {
        const parentId = current.parentEquipmentId
        if (ancestors.has(parentId)) throw new Error('Equipment variant cycle detected.')
        if (ancestors.size >= 500)
          throw new Error('Equipment inheritance exceeds the authoring limit.')
        const parent = publications.get(parentId)
        if (parent?.subjectKind !== 'EQUIPMENT')
          throw new Error('Readable parent Equipment in the same System is required.')
        ancestors.set(parent.document.id, parent.document)
        current = parent.document
      }
      return ancestors
    },
    readFeatureSources: async (missingFeatureIds) =>
      FEATURE_SOURCE_KINDS.flatMap((kind) =>
        (publicationsByKind.get(kind) ?? []).filter((published) => {
          const features = [
            ...('features' in published.document ? (published.document.features ?? []) : []),
            ...(published.subjectKind === 'RACE' && published.document.category === 'BASE'
              ? (published.document.ancestry?.options.flatMap((option) => option.features ?? []) ??
                [])
              : [])
          ]
          return features.some((feature) => missingFeatureIds.has(feature.id))
        })
      ),
    readSpellCatalogue: async () =>
      (publicationsByKind.get('SPELL') ?? []).flatMap((published) =>
        published.subjectKind === 'SPELL' ? [published.document] : []
      ),
    readRaces: async () => {
      const races = [...index.RACE.values()]
      const bases = new Map(
        races.flatMap((race) => (race.category === 'BASE' ? [[race.id, race] as const] : []))
      )
      return races.map((race): CharacterBuilderRaceCatalogSource => {
        if (race.category === 'BASE') return race
        const parent = bases.get(race.parentRaceId)
        if (!parent || race.parentRaceId === race.id)
          throw new Error('A readable base Race in the same System is required.')
        return {
          ...race,
          size: parent.size,
          speeds: parent.speeds,
          abilityScoreIncreaseFacts: [
            ...parent.abilityScoreIncreaseFacts,
            ...race.abilityScoreIncreaseFacts
          ]
        }
      })
    },
    readClasses: async () => [...index.CLASS.values()],
    readBackgrounds: async () => [...index.BACKGROUND.values()],
    readEquipment: async () => ({ entries: [...index.EQUIPMENT.values()] }),
    readFeats: async () => [...index.FEAT.values()].map(({ id, label }) => ({ id, label }))
  }
}
