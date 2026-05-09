import {
  queryOptions,
  useSuspenseQuery } from '@tanstack/react-query'
import type { ClassListItemDto } from '@artificer-toolkit/schema/api/content'
import { CreatureListItemDto } from '@artificer-toolkit/schema/api/content'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildEffectReferenceData } from '#app/data/effects'

export type SpellReferenceOption = {
  value: string
  label: string
}

export type SpellReferenceData = {
  systemId: string
  magicSchools: SpellReferenceOption[]
  classes: SpellReferenceOption[]
  damageTypes: SpellReferenceOption[]
  conditionTypes: SpellReferenceOption[]
  skills: SpellReferenceOption[]
  speeds: SpellReferenceOption[]
  creatures: SpellReferenceOption[]
}

function toVocabularyOptions(items: Array<{ id: string, label: string }>): SpellReferenceOption[] {
  return items.map((item) => ({ value: item.id, label: item.label }))
}

function toContentOptions(items: Array<ClassListItemDto | CreatureListItemDto>): SpellReferenceOption[] {
  return items.map((item) => ({ value: item.id, label: item.label }))
}

function emptySystem(): SystemAuthoredDto {
  return {
    id: 'default-system',
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

export function getSpellReferenceData(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.spells.referenceData(),
    queryFn: async (): Promise<SpellReferenceData> => {
      const systems = await client.systems.list()
      const systemId = systems[0]?.id ?? 'default-system'
      const [system, classes, creatures] = await Promise.all([
        systems[0] ? client.systems.get(systemId) : Promise.resolve(emptySystem()),
        client.content.classes.list(),
        client.content.creatures.list()
      ])

      const resolvedSystem = system ?? emptySystem()
      const effectReferences = buildEffectReferenceData(resolvedSystem, creatures.items)

      return {
        systemId: resolvedSystem.id,
        magicSchools: toVocabularyOptions(resolvedSystem.magicSchools),
        classes: toContentOptions(classes.items),
        damageTypes: effectReferences.damageTypes,
        conditionTypes: effectReferences.conditionTypes,
        skills: toVocabularyOptions(resolvedSystem.skills),
        speeds: toVocabularyOptions(resolvedSystem.speeds),
        creatures: effectReferences.creatures
      }
    }
  })
}

export function useGetSpellReferenceData() {
  return useSuspenseQuery(getSpellReferenceData())
}
