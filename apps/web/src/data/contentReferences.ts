import {
  queryOptions,
  useSuspenseQuery
} from '@tanstack/react-query'
import type {
  ClassListItemDto,
  CreatureListItemDto,
  EquipmentListItemDto,
  RaceListItemDto
} from '@artificer-toolkit/schema/api/content'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export type ReferenceOption = {
  value: string
  label: string
}

export type AuthoredContentReferenceData = {
  systemId: string
  challengeRatings: ReferenceOption[]
  conditionTypes: ReferenceOption[]
  creatureTypes: ReferenceOption[]
  currencies: ReferenceOption[]
  damageTypes: ReferenceOption[]
  heritages: ReferenceOption[]
  languages: ReferenceOption[]
  magicSchools: ReferenceOption[]
  rarities: ReferenceOption[]
  skills: ReferenceOption[]
  speeds: ReferenceOption[]
  classes: ReferenceOption[]
  creatures: ReferenceOption[]
  equipment: ReferenceOption[]
  races: ReferenceOption[]
}

type ContentReferenceApi = {
  systems: Pick<Api['systems'], 'get' | 'list'>
  content: {
    classes: Pick<Api['content']['classes'], 'list'>
    creatures: Pick<Api['content']['creatures'], 'list'>
    equipment: Pick<Api['content']['equipment'], 'list'>
    races: Pick<Api['content']['races'], 'list'>
  }
}

function toVocabularyOptions(items: Array<{ id: string, label: string }>): ReferenceOption[] {
  return items.map((item) => ({ value: item.id, label: item.label }))
}

function toContentOptions(items: Array<ClassListItemDto | CreatureListItemDto | EquipmentListItemDto | RaceListItemDto>): ReferenceOption[] {
  return items.map((item) => ({ value: item.id, label: item.label }))
}

function emptySystem(systemId = 'default-system'): SystemAuthoredDto {
  return {
    id: systemId,
    label: 'Default System',
    rulesetCode: 'dnd5e',
    rulesetVersion: '2014',
    alignments: [],
    challengeRatings: [],
    conditionTypes: [],
    creatureTypes: [],
    currencies: [],
    damageTypes: [],
    heritages: [],
    languages: [],
    lifestyles: [],
    magicSchools: [],
    passives: [],
    rarities: [],
    senses: [],
    skills: [],
    speeds: [],
    terrains: [],
    userId: 'master'
  }
}

function buildReferenceData(
  system: SystemAuthoredDto,
  content: {
    classes: ClassListItemDto[]
    creatures: CreatureListItemDto[]
    equipment: EquipmentListItemDto[]
    races: RaceListItemDto[]
  }
): AuthoredContentReferenceData {
  return {
    systemId: system.id,
    challengeRatings: toVocabularyOptions(system.challengeRatings),
    conditionTypes: toVocabularyOptions(system.conditionTypes),
    creatureTypes: toVocabularyOptions(system.creatureTypes),
    currencies: toVocabularyOptions(system.currencies),
    damageTypes: toVocabularyOptions(system.damageTypes),
    heritages: toVocabularyOptions(system.heritages),
    languages: toVocabularyOptions(system.languages),
    magicSchools: toVocabularyOptions(system.magicSchools),
    rarities: toVocabularyOptions(system.rarities),
    skills: toVocabularyOptions(system.skills),
    speeds: toVocabularyOptions(system.speeds),
    classes: toContentOptions(content.classes),
    creatures: toContentOptions(content.creatures),
    equipment: toContentOptions(content.equipment),
    races: toContentOptions(content.races)
  }
}

export async function loadAuthoredContentReferenceData(
  systemId: string | undefined,
  client: ContentReferenceApi = api
): Promise<AuthoredContentReferenceData> {
  const systems = await client.systems.list()
  const targetSystemId = systemId ?? systems[0]?.id
  if (!targetSystemId) {
    return buildReferenceData(emptySystem(), {
      classes: [],
      creatures: [],
      equipment: [],
      races: []
    })
  }

  const [system, classes, creatures, equipment, races] = await Promise.all([
    client.systems.get(targetSystemId),
    client.content.classes.list(),
    client.content.creatures.list(),
    client.content.equipment.list(),
    client.content.races.list()
  ])

  const belongsToSystem = (item: { systemId: string }) => item.systemId === targetSystemId

  return buildReferenceData(system ?? emptySystem(targetSystemId), {
    classes: classes.items.filter(belongsToSystem),
    creatures: creatures.items.filter(belongsToSystem),
    equipment: equipment.items.filter(belongsToSystem),
    races: races.items.filter(belongsToSystem)
  })
}

export function getAuthoredContentReferenceData(systemId: string | undefined, client: ContentReferenceApi = api) {
  const querySystemId = systemId ?? 'default-system'

  return queryOptions({
    queryKey: queryKeys.content.referenceData(querySystemId),
    queryFn: async () => loadAuthoredContentReferenceData(systemId, client),
    staleTime: 5 * 60_000
  })
}

export function useGetAuthoredContentReferenceData(systemId?: string) {
  return useSuspenseQuery(getAuthoredContentReferenceData(systemId))
}
