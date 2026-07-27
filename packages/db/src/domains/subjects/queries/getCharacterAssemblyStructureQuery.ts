import type { DBLike } from '#types'
import { sql } from 'kysely'

export type CharacterAssemblyFeatureOwnerKind =
  | 'RACE'
  | 'CLASS'
  | 'BACKGROUND'
  | 'FEAT'
  | 'EQUIPMENT'

export interface CharacterAssemblyStructureQueryInput {
  raceIds: readonly string[]
  classIds: readonly string[]
  backgroundIds: readonly string[]
  featIds: readonly string[]
  equipmentIds: readonly string[]
  featureIds: readonly string[]
}

export interface CharacterAssemblyRootFeatureLink {
  ownerKind: CharacterAssemblyFeatureOwnerKind
  ownerId: string
  featureId: string
  order: number
  availableAtLevel: number | null
}

export interface CharacterAssemblyAncestryOptionFeatureLink {
  featureId: string
  order: number
  availableAtLevel: number | null
}

export interface CharacterAssemblyAncestryOptionStructure {
  raceId: string
  ancestryOptionId: string
  order: number
  featureLinks: CharacterAssemblyAncestryOptionFeatureLink[]
}

export interface CharacterAssemblyFeatureOptionLink {
  featureId: string
  optionId: string
  order: number
}

export interface CharacterAssemblyFeatureOptionChoice {
  featureId: string
  level: number
  count: number
  order: number
}

export interface CharacterAssemblyStructureQueryResult {
  rootFeatureLinks: CharacterAssemblyRootFeatureLink[]
  ancestryOptions: CharacterAssemblyAncestryOptionStructure[]
  featureOptions: CharacterAssemblyFeatureOptionLink[]
  featureOptionChoices: CharacterAssemblyFeatureOptionChoice[]
}

interface RootFeatureRow {
  ownerId: string
  featureId: string
  order: number
  availableAtLevel: number | null
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

function toRootFeatureLinks(
  ownerKind: CharacterAssemblyFeatureOwnerKind,
  rows: readonly RootFeatureRow[]
): CharacterAssemblyRootFeatureLink[] {
  return rows.map((row) => ({
    ownerKind,
    ownerId: row.ownerId,
    featureId: row.featureId,
    order: row.order,
    availableAtLevel: row.availableAtLevel
  }))
}

export async function getCharacterAssemblyStructureQuery(
  db: DBLike,
  input: CharacterAssemblyStructureQueryInput
): Promise<CharacterAssemblyStructureQueryResult> {
  const raceIds = uniqueIds(input.raceIds)
  const classIds = uniqueIds(input.classIds)
  const backgroundIds = uniqueIds(input.backgroundIds)
  const featIds = uniqueIds(input.featIds)
  const equipmentIds = uniqueIds(input.equipmentIds)
  const directlyAcquiredFeatureIds = uniqueIds(input.featureIds)

  const raceFeatureQuery = db
    .selectFrom('race_features')
    .innerJoin('features', 'features.id', 'race_features.feature_id')
    .select([
      'race_features.race_id as ownerId',
      'race_features.feature_id as featureId',
      'race_features.sort_order as order',
      'features.available_at_level as availableAtLevel'
    ])
    .orderBy('race_features.race_id')
    .orderBy('race_features.sort_order')

  const classFeatureQuery = db
    .selectFrom('class_features')
    .innerJoin('features', 'features.id', 'class_features.feature_id')
    .select([
      'class_features.class_id as ownerId',
      'class_features.feature_id as featureId',
      'class_features.sort_order as order',
      'features.available_at_level as availableAtLevel'
    ])
    .orderBy('class_features.class_id')
    .orderBy('class_features.sort_order')

  const backgroundFeatureQuery = db
    .selectFrom('background_features')
    .innerJoin('features', 'features.id', 'background_features.feature_id')
    .select([
      'background_features.background_id as ownerId',
      'background_features.feature_id as featureId',
      'background_features.sort_order as order',
      'features.available_at_level as availableAtLevel'
    ])
    .orderBy('background_features.background_id')
    .orderBy('background_features.sort_order')

  const featFeatureQuery = db
    .selectFrom('feat_features')
    .innerJoin('features', 'features.id', 'feat_features.feature_id')
    .select([
      'feat_features.feat_id as ownerId',
      'feat_features.feature_id as featureId',
      'feat_features.sort_order as order',
      'features.available_at_level as availableAtLevel'
    ])
    .orderBy('feat_features.feat_id')
    .orderBy('feat_features.sort_order')

  const equipmentFeatureQuery = db
    .selectFrom('equipment_features')
    .innerJoin('features', 'features.id', 'equipment_features.feature_id')
    .select([
      'equipment_features.equipment_id as ownerId',
      'equipment_features.feature_id as featureId',
      'equipment_features.sort_order as order',
      'features.available_at_level as availableAtLevel'
    ])
    .orderBy('equipment_features.equipment_id')
    .orderBy('equipment_features.sort_order')

  const ancestryOptionQuery = db
    .selectFrom('race_ancestries')
    .innerJoin('race_ancestry_options', 'race_ancestry_options.ancestry_id', 'race_ancestries.id')
    .leftJoin(
      'race_ancestry_option_features',
      'race_ancestry_option_features.ancestry_option_id',
      'race_ancestry_options.id'
    )
    .leftJoin('features', 'features.id', 'race_ancestry_option_features.feature_id')
    .select([
      'race_ancestries.race_id as raceId',
      'race_ancestry_options.id as ancestryOptionId',
      'race_ancestry_options.sort_order as ancestryOptionOrder',
      'race_ancestry_option_features.feature_id as featureId',
      'race_ancestry_option_features.sort_order as featureOrder',
      'features.available_at_level as availableAtLevel'
    ])
    .orderBy('race_ancestries.race_id')
    .orderBy('race_ancestry_options.sort_order')
    .orderBy('race_ancestry_option_features.sort_order')

  const [
    raceFeatureRows,
    classFeatureRows,
    backgroundFeatureRows,
    featFeatureRows,
    equipmentFeatureRows,
    ancestryOptionRows
  ] = await Promise.all([
    (raceIds.length > 0
      ? raceFeatureQuery.where('race_features.race_id', 'in', raceIds)
      : raceFeatureQuery.where(sql<boolean>`false`)
    ).execute(),
    (classIds.length > 0
      ? classFeatureQuery.where('class_features.class_id', 'in', classIds)
      : classFeatureQuery.where(sql<boolean>`false`)
    ).execute(),
    (backgroundIds.length > 0
      ? backgroundFeatureQuery.where('background_features.background_id', 'in', backgroundIds)
      : backgroundFeatureQuery.where(sql<boolean>`false`)
    ).execute(),
    (featIds.length > 0
      ? featFeatureQuery.where('feat_features.feat_id', 'in', featIds)
      : featFeatureQuery.where(sql<boolean>`false`)
    ).execute(),
    (equipmentIds.length > 0
      ? equipmentFeatureQuery.where('equipment_features.equipment_id', 'in', equipmentIds)
      : equipmentFeatureQuery.where(sql<boolean>`false`)
    ).execute(),
    (raceIds.length > 0
      ? ancestryOptionQuery.where('race_ancestries.race_id', 'in', raceIds)
      : ancestryOptionQuery.where(sql<boolean>`false`)
    ).execute()
  ])

  const rootFeatureLinks = [
    ...toRootFeatureLinks('RACE', raceFeatureRows),
    ...toRootFeatureLinks('CLASS', classFeatureRows),
    ...toRootFeatureLinks('BACKGROUND', backgroundFeatureRows),
    ...toRootFeatureLinks('FEAT', featFeatureRows),
    ...toRootFeatureLinks('EQUIPMENT', equipmentFeatureRows)
  ]

  const ancestryOptionsById = new Map<string, CharacterAssemblyAncestryOptionStructure>()
  for (const row of ancestryOptionRows) {
    const ancestryOption = ancestryOptionsById.get(row.ancestryOptionId) ?? {
      raceId: row.raceId,
      ancestryOptionId: row.ancestryOptionId,
      order: row.ancestryOptionOrder,
      featureLinks: []
    }

    if (row.featureId && row.featureOrder !== null) {
      ancestryOption.featureLinks.push({
        featureId: row.featureId,
        order: row.featureOrder,
        availableAtLevel: row.availableAtLevel
      })
    }
    ancestryOptionsById.set(row.ancestryOptionId, ancestryOption)
  }
  const ancestryOptions = [...ancestryOptionsById.values()]
  const featureIds = uniqueIds([
    ...directlyAcquiredFeatureIds,
    ...rootFeatureLinks.map((link) => link.featureId),
    ...ancestryOptions.flatMap((option) => option.featureLinks.map((link) => link.featureId))
  ])

  const featureOptionQuery = db
    .selectFrom('feature_options')
    .select(['feature_id as featureId', 'option_id as optionId', 'sort_order as order'])
    .orderBy('feature_id')
    .orderBy('sort_order')

  const featureOptionChoiceQuery = db
    .selectFrom('feature_option_levels')
    .select(['feature_id as featureId', 'level', 'count', 'sort_order as order'])
    .orderBy('feature_id')
    .orderBy('sort_order')

  const [featureOptions, featureOptionChoices] = await Promise.all([
    (featureIds.length > 0
      ? featureOptionQuery.where('feature_id', 'in', featureIds)
      : featureOptionQuery.where(sql<boolean>`false`)
    ).execute(),
    (featureIds.length > 0
      ? featureOptionChoiceQuery.where('feature_id', 'in', featureIds)
      : featureOptionChoiceQuery.where(sql<boolean>`false`)
    ).execute()
  ])

  return {
    rootFeatureLinks,
    ancestryOptions,
    featureOptions,
    featureOptionChoices
  }
}
