import {
  queryOptions,
  useSuspenseQuery } from '@tanstack/react-query'
import type { CreatureListItemDto } from '@artificer-toolkit/schema/api/content'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export type EffectReferenceOption = {
  value: string
  label: string
}

export type EffectReferenceData = {
  systemId: string
  damageTypes: EffectReferenceOption[]
  conditionTypes: EffectReferenceOption[]
  creatures: EffectReferenceOption[]
}

export type EffectReferenceApi = {
  systems: Pick<Api['systems'], 'get' | 'list'>
  content: {
    creatures: Pick<Api['content']['creatures'], 'list'>
  }
}

function toVocabularyOptions(items: Array<{ id: string, label: string }>): EffectReferenceOption[] {
  return items.map((item) => ({ value: item.id, label: item.label }))
}

function toContentOptions(items: CreatureListItemDto[]): EffectReferenceOption[] {
  return items.map((item) => ({ value: item.id, label: item.label }))
}

function emptySystem(systemId = 'default-system'): SystemAuthoredDto {
  return {
    id: systemId,
    label: 'Default System',
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

export function buildEffectReferenceData(
  system: SystemAuthoredDto,
  creatures: CreatureListItemDto[]
): EffectReferenceData {
  return {
    systemId: system.id,
    damageTypes: toVocabularyOptions(system.damageTypes),
    conditionTypes: toVocabularyOptions(system.conditionTypes),
    creatures: toContentOptions(creatures)
  }
}

export async function loadEffectReferenceData(
  systemId: string | undefined,
  client: EffectReferenceApi = api
): Promise<EffectReferenceData> {
  const systems = await client.systems.list()
  const targetSystemId = systemId ?? systems[0]?.id
  if (!targetSystemId) return emptySystemReferenceData()

  const [system, creatures] = await Promise.all([
    client.systems.get(targetSystemId),
    client.content.creatures.list()
  ])
  const systemCreatureItems = creatures.items.filter((creature) => creature.systemId === targetSystemId)

  return buildEffectReferenceData(system ?? emptySystem(targetSystemId), systemCreatureItems)
}

export function getEffectReferenceData(systemId?: string, client: EffectReferenceApi = api) {
  const querySystemId = systemId ?? 'default-system'

  return queryOptions({
    queryKey: queryKeys.content.effects.referenceData(querySystemId),
    queryFn: async () => loadEffectReferenceData(systemId, client)
  })
}

function emptySystemReferenceData(): EffectReferenceData {
  return buildEffectReferenceData(emptySystem(), [])
}

export function useGetEffectReferenceData(systemId?: string) {
  return useSuspenseQuery(getEffectReferenceData(systemId))
}
