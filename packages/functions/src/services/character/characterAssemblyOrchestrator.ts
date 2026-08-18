import {
  createAuthoredVersionRepository,
  createFeatureRepository,
  createSystemRepository,
  getCharacterAssemblyStructureQuery,
  type AuthoredSubjectKind,
  type AuthoredVersionRecord,
  type DBLike
} from '@artificer-toolkit/db'
import type { AuthoredVersionVector } from '@artificer-toolkit/schema/projections/identity'
import type {
  BackgroundAuthored,
  CharacterAuthored,
  ClassAuthored,
  EquipmentAuthored,
  FeatAuthored,
  RaceAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import {
  resolveEquipmentAuthored,
  resolveRaceAuthored,
  type ResolvedEquipment,
  type ResolvedRace
} from '@artificer-toolkit/shared/subjects/compilers'

import type { CharacterBuilderCatalog } from './builderCatalog.js'
import type { CharacterBuilderRegistry } from './builderService.js'
import { planCharacterAssembly, type CharacterAssemblyPlan } from './characterAssemblyPlanner.js'
import {
  buildCampaignAssemblyStructure,
  hydrateCampaignSelectedContent,
  type CampaignCharacterContentOverlay
} from './campaignCharacterContent.js'

export interface CharacterAssemblyLoadResult {
  registry: CharacterBuilderRegistry
  plan: CharacterAssemblyPlan
}

interface VersionedCharacterSource<T extends { id: string; systemId: string }> {
  authored: T
  authoredDependencies: readonly AuthoredVersionVector[number][]
}

function toVersionedCharacterSource<T extends { id: string; systemId: string }>(
  record: AuthoredVersionRecord
): VersionedCharacterSource<T> {
  return {
    authored: record.authored.document as unknown as T,
    authoredDependencies: record.compiled.authoredDependencies
  }
}

async function loadExactCharacterDependency(
  db: DBLike,
  owner: VersionedCharacterSource<{ id: string; systemId: string }>,
  subjectKind: AuthoredSubjectKind,
  subjectId: string
): Promise<AuthoredVersionRecord> {
  const dependency = owner.authoredDependencies.find(
    (entry) => entry.subjectKind === subjectKind && entry.subjectId === subjectId
  )
  if (!dependency) {
    throw new Error(
      `Character source "${owner.authored.id}" is missing exact ${subjectKind} dependency "${subjectId}".`
    )
  }
  const records = await createAuthoredVersionRepository(db).findExactVersions({
    entries: [dependency]
  })
  const record = records.get(`${subjectKind}:${subjectId}`)
  if (!record) {
    throw new Error(
      `Character source "${owner.authored.id}" has an unavailable exact ${subjectKind} dependency "${subjectId}".`
    )
  }
  return record
}

async function loadActiveCharacterSources<T extends { id: string; systemId: string }>(
  db: DBLike,
  subjectKind: AuthoredSubjectKind,
  subjectIds: readonly string[],
  systemId: string,
  userId: string
): Promise<Map<string, VersionedCharacterSource<T>>> {
  const ids = [...new Set(subjectIds)]
  if (ids.length === 0) return new Map()
  const records = await createAuthoredVersionRepository(db).findActiveByIds({
    subjectKind,
    subjectIds: ids,
    systemId,
    userId,
    includeMaster: true
  })
  return new Map(
    [...records.entries()].flatMap(([id, record]) => {
      const source = toVersionedCharacterSource<T>(record)
      return source.authored.systemId === systemId ? [[id, source] as const] : []
    })
  )
}

async function resolveActiveCharacterRaces(
  db: DBLike,
  subjectIds: readonly string[],
  systemId: string,
  userId: string
): Promise<ResolvedRace[]> {
  const roots = await loadActiveCharacterSources<RaceAuthored>(
    db,
    'RACE',
    subjectIds,
    systemId,
    userId
  )
  return Promise.all(
    [...new Set(subjectIds)].flatMap(async (subjectId) => {
      const root = roots.get(subjectId)
      if (!root) return []
      const parents = new Map<string, RaceAuthored>()
      const loadParents = async (
        source: VersionedCharacterSource<RaceAuthored>,
        lineage: ReadonlySet<string> = new Set()
      ): Promise<void> => {
        if (source.authored.category !== 'SUBRACE') return
        if (lineage.has(source.authored.id)) {
          throw new Error(`Character Subrace "${source.authored.id}" has a parent cycle.`)
        }
        const parentRecord = await loadExactCharacterDependency(
          db,
          source,
          'RACE',
          source.authored.parentRaceId
        )
        const parent = toVersionedCharacterSource<RaceAuthored>(parentRecord)
        if (parent.authored.systemId !== systemId) {
          throw new Error(
            `Character Race dependency "${parent.authored.id}" belongs to another rules system.`
          )
        }
        parents.set(parent.authored.id, parent.authored)
        await loadParents(parent, new Set([...lineage, source.authored.id]))
      }
      await loadParents(root)
      return [resolveRaceAuthored(root.authored, (parentId) => parents.get(parentId))]
    })
  ).then((records) => records.flat())
}

export async function resolveActiveCharacterEquipment(
  db: DBLike,
  subjectIds: readonly string[],
  systemId: string,
  userId: string
): Promise<ResolvedEquipment[]> {
  const roots = await loadActiveCharacterSources<EquipmentAuthored>(
    db,
    'EQUIPMENT',
    subjectIds,
    systemId,
    userId
  )
  return Promise.all(
    [...new Set(subjectIds)].flatMap(async (subjectId) => {
      const root = roots.get(subjectId)
      if (!root) return []
      const parents = new Map<string, EquipmentAuthored>()
      const loadParents = async (
        source: VersionedCharacterSource<EquipmentAuthored>,
        lineage: ReadonlySet<string> = new Set()
      ): Promise<void> => {
        if (source.authored.category !== 'VARIANT') return
        if (lineage.has(source.authored.id)) {
          throw new Error(`Character Equipment variant "${source.authored.id}" has a parent cycle.`)
        }
        const parentRecord = await loadExactCharacterDependency(
          db,
          source,
          'EQUIPMENT',
          source.authored.parentEquipmentId
        )
        const parent = toVersionedCharacterSource<EquipmentAuthored>(parentRecord)
        if (parent.authored.systemId !== systemId) {
          throw new Error(
            `Character Equipment dependency "${parent.authored.id}" belongs to another rules system.`
          )
        }
        parents.set(parent.authored.id, parent.authored)
        await loadParents(parent, new Set([...lineage, source.authored.id]))
      }
      await loadParents(root)
      return [resolveEquipmentAuthored(root.authored, (parentId) => parents.get(parentId))]
    })
  ).then((records) => records.flat())
}

export async function loadCharacterAssemblyRegistry(params: {
  db: DBLike
  character: CharacterAuthored
  catalog: CharacterBuilderCatalog
  campaignContent?: CampaignCharacterContentOverlay | null
  includeEffects?: boolean
  knownFeatIds?: ReadonlySet<string>
}): Promise<CharacterAssemblyLoadResult> {
  const { db, character, catalog, campaignContent, includeEffects = false } = params
  const selectedRaceIds = [
    ...new Set(
      [character.intent.race.raceId, character.intent.race.subraceId].filter((id): id is string =>
        Boolean(id)
      )
    )
  ]
  const selectedClassIds = [
    ...new Set(
      character.intent.classes.flatMap((selection) =>
        [selection.classId, selection.subclassId].filter((id): id is string => Boolean(id))
      )
    )
  ]
  const selectedBackgroundIds = character.intent.background.backgroundId
    ? [character.intent.background.backgroundId]
    : []
  const ownedEquipmentIds = [
    ...new Set(character.state.equipment.inventory.map((item) => item.equipmentId))
  ]
  const catalogFeatIds = params.knownFeatIds ?? new Set(catalog.feats.map((feat) => feat.id))
  const selectedFeatIds = new Set([
    ...character.intent.featureAcquisitions.flatMap((acquisition) =>
      acquisition.source.kind === 'FEAT' ? [acquisition.source.featId] : []
    ),
    ...(character.intent.chosenGrantSelections ?? []).flatMap((selection) =>
      selection.targetIds.filter((targetId) => catalogFeatIds.has(targetId))
    )
  ])
  const directlyAcquiredFeatureIds = [
    ...new Set(character.intent.featureAcquisitions.map((acquisition) => acquisition.featureId))
  ]
  const canonicalStructure = await getCharacterAssemblyStructureQuery(db, {
    raceIds: selectedRaceIds,
    classIds: selectedClassIds,
    backgroundIds: selectedBackgroundIds,
    featIds: [...selectedFeatIds],
    equipmentIds: ownedEquipmentIds,
    featureIds: directlyAcquiredFeatureIds
  })
  const campaignRegistry = campaignContent
    ? await hydrateCampaignSelectedContent(db, campaignContent, {
        raceIds: selectedRaceIds,
        classIds: selectedClassIds,
        backgroundIds: selectedBackgroundIds,
        featIds: [...selectedFeatIds],
        equipmentIds: ownedEquipmentIds,
        systemId: character.systemId
      })
    : null
  const campaignStructure = campaignRegistry
    ? buildCampaignAssemblyStructure(campaignRegistry)
    : null
  const campaignRootKeys = new Set(
    campaignStructure?.rootFeatureLinks.map((link) => `${link.ownerKind}:${link.ownerId}`) ?? []
  )
  const campaignRaceIds = new Set(campaignRegistry?.races.map((record) => record.id) ?? [])
  const campaignFeatureIds = new Set(
    campaignStructure?.rootFeatureLinks.map((link) => link.featureId) ?? []
  )
  for (const option of campaignStructure?.ancestryOptions ?? []) {
    for (const link of option.featureLinks) campaignFeatureIds.add(link.featureId)
  }
  const structure = campaignStructure
    ? {
        rootFeatureLinks: [
          ...canonicalStructure.rootFeatureLinks.filter(
            (link) => !campaignRootKeys.has(`${link.ownerKind}:${link.ownerId}`)
          ),
          ...campaignStructure.rootFeatureLinks
        ],
        ancestryOptions: [
          ...canonicalStructure.ancestryOptions.filter(
            (option) => !campaignRaceIds.has(option.raceId)
          ),
          ...campaignStructure.ancestryOptions
        ],
        featureOptions: [
          ...canonicalStructure.featureOptions.filter(
            (option) => !campaignFeatureIds.has(option.featureId)
          ),
          ...campaignStructure.featureOptions
        ],
        featureOptionChoices: [
          ...canonicalStructure.featureOptionChoices.filter(
            (choice) => !campaignFeatureIds.has(choice.featureId)
          ),
          ...campaignStructure.featureOptionChoices
        ]
      }
    : canonicalStructure
  const plan = planCharacterAssembly({ character, structure, selectedFeatIds })
  const structurallyOwnedFeatureIds = new Set([
    ...structure.rootFeatureLinks.map((link) => link.featureId),
    ...structure.ancestryOptions.flatMap((option) =>
      option.featureLinks.map((link) => link.featureId)
    )
  ])
  const activeAcquiredFeatureIds = directlyAcquiredFeatureIds.filter(
    (featureId) =>
      plan.activeFeatureIds.has(featureId) &&
      !structurallyOwnedFeatureIds.has(featureId) &&
      !selectedFeatIds.has(featureId)
  )
  const featureRepository = createFeatureRepository(db, character.systemId)

  const [system, races, classesById, backgroundsById, featsById, featuresById, equipment] =
    await Promise.all([
      createSystemRepository(db).findById(character.systemId),
      resolveActiveCharacterRaces(
        db,
        selectedRaceIds,
        character.systemId,
        character.userId
      ),
      loadActiveCharacterSources<ClassAuthored>(
        db,
        'CLASS',
        selectedClassIds,
        character.systemId,
        character.userId
      ).then((sources) => new Map([...sources].map(([id, source]) => [id, source.authored]))),
      loadActiveCharacterSources<BackgroundAuthored>(
        db,
        'BACKGROUND',
        selectedBackgroundIds,
        character.systemId,
        character.userId
      ).then((sources) => new Map([...sources].map(([id, source]) => [id, source.authored]))),
      loadActiveCharacterSources<FeatAuthored>(
        db,
        'FEAT',
        [...selectedFeatIds],
        character.systemId,
        character.userId
      ).then((sources) => new Map([...sources].map(([id, source]) => [id, source.authored]))),
      activeAcquiredFeatureIds.length > 0
        ? featureRepository.findByIds(activeAcquiredFeatureIds, { includeEffects })
        : Promise.resolve(new Map<string, FeatureAuthored>()),
      resolveActiveCharacterEquipment(
        db,
        ownedEquipmentIds,
        character.systemId,
        character.userId
      )
    ])

  return {
    plan,
    registry: {
      system,
      races: replaceRecords(races, campaignRegistry?.races ?? []),
      classes: replaceRecords(
        selectedClassIds.flatMap((classId) => {
          const record = classesById.get(classId)
          return record ? [record] : []
        }),
        campaignRegistry?.classes ?? []
      ),
      backgrounds: replaceRecords(
        selectedBackgroundIds.flatMap((backgroundId) => {
          const record = backgroundsById.get(backgroundId)
          return record ? [record] : []
        }),
        campaignRegistry?.backgrounds ?? []
      ),
      equipment: replaceRecords(equipment, campaignRegistry?.equipment ?? []),
      feats: replaceRecords(
        [...selectedFeatIds].flatMap((featId) => {
          const record = featsById.get(featId)
          return record ? [record] : []
        }),
        campaignRegistry?.feats ?? []
      ),
      features: activeAcquiredFeatureIds.flatMap((featureId) => {
        const feature = featuresById.get(featureId)
        return feature ? [feature] : []
      })
    }
  }
}

function replaceRecords<T extends { id: string }>(
  current: readonly T[],
  campaign: readonly T[]
): T[] {
  const campaignIds = new Set(campaign.map((record) => record.id))
  return [...current.filter((record) => !campaignIds.has(record.id)), ...campaign]
}
