import {
  createBackgroundRepository,
  createClassRepository,
  createEquipmentRepository,
  createFeatRepository,
  createFeatureRepository,
  createRaceRepository,
  createSystemRepository,
  getCharacterAssemblyStructureQuery,
  type DBLike
} from '@artificer-toolkit/db'
import type {
  BackgroundAuthored,
  CharacterAuthored,
  ClassAuthored,
  FeatAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ResolvedEquipment, ResolvedRace } from '@artificer-toolkit/shared/subjects/compilers'

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

export async function loadCharacterAssemblyRegistry(params: {
  db: DBLike
  character: CharacterAuthored
  catalog: CharacterBuilderCatalog
  campaignContent?: CampaignCharacterContentOverlay | null
  includeEffects?: boolean
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
  const catalogFeatIds = new Set(catalog.feats.map((feat) => feat.id))
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
        equipmentIds: ownedEquipmentIds
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
  const raceRepository = createRaceRepository(db)
  const classRepository = createClassRepository(db)
  const backgroundRepository = createBackgroundRepository(db)
  const featRepository = createFeatRepository(db)
  const featureRepository = createFeatureRepository(db, character.systemId)
  const equipmentRepository = createEquipmentRepository(db)
  const selectedFeatureOptions = {
    allowedFeatureIds: plan.activeFeatureIds,
    includeFeatureEffects: includeEffects
  }

  const [system, races, classesById, backgroundsById, featsById, featuresById, equipment] =
    await Promise.all([
      createSystemRepository(db).findById(character.systemId),
      Promise.all(
        selectedRaceIds.map((raceId) =>
          raceRepository.findResolvedById(raceId, {
            systemId: character.systemId,
            // The builder exposes every ancestry option as an immediate, backend-supplied preview.
            // Restricting this query to the active assembly plan leaves every other option without
            // its feature summaries until a later resolver request completes.
            includeFeatureEffects: includeEffects
          })
        )
      ).then((records) => records.filter((record): record is ResolvedRace => record !== null)),
      selectedClassIds.length > 0
        ? classRepository.findByIds(selectedClassIds, {
            systemId: character.systemId,
            ...selectedFeatureOptions
          })
        : Promise.resolve(new Map<string, ClassAuthored>()),
      selectedBackgroundIds.length > 0
        ? backgroundRepository.findByIds(selectedBackgroundIds, {
            systemId: character.systemId,
            ...selectedFeatureOptions
          })
        : Promise.resolve(new Map<string, BackgroundAuthored>()),
      selectedFeatIds.size > 0
        ? featRepository.findByIds([...selectedFeatIds], {
            systemId: character.systemId,
            allowedFeatureIds: plan.activeFeatureIds,
            includeEffects
          })
        : Promise.resolve(new Map<string, FeatAuthored>()),
      activeAcquiredFeatureIds.length > 0
        ? featureRepository.findByIds(activeAcquiredFeatureIds, { includeEffects })
        : Promise.resolve(new Map<string, FeatureAuthored>()),
      Promise.all(
        ownedEquipmentIds.map((equipmentId) =>
          equipmentRepository.findResolvedById(equipmentId, {
            systemId: character.systemId,
            allowedFeatureIds: plan.activeFeatureIds,
            includeEffects
          })
        )
      ).then((records) => records.filter((record): record is ResolvedEquipment => record !== null))
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
