import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import type {
  ClassListItemDto,
  CreatureListItemDto,
  SpellListResponseDto
} from '@artificer-toolkit/schema/api/content'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildEffectReferenceData } from '#app/data/effects'
import { loadPagedAuthoredCatalogItems } from '#app/data/authoredCatalogPages'

export type SpellReferenceOption = {
  value: string
  label: string
}

export type SpellReferenceData = {
  systemId: string
  abilities: SpellReferenceOption[]
  magicSchools: SpellReferenceOption[]
  classes: SpellReferenceOption[]
  damageTypes: SpellReferenceOption[]
  conditionTypes: SpellReferenceOption[]
  skills: SpellReferenceOption[]
  speeds: SpellReferenceOption[]
  creatures: SpellReferenceOption[]
}

export type SpellDetailReferenceData = Pick<
  SpellReferenceData,
  'magicSchools' | 'classes' | 'damageTypes' | 'conditionTypes'
> & {
  abilities?: SpellReferenceOption[]
}

type SpellListMetaGroup = {
  id: string | number
  label?: string
}

type SpellListMeta = {
  classes?: SpellListMetaGroup[]
  schools?: SpellListMetaGroup[]
}

function toVocabularyOptions(items: Array<{ id: string; label: string }>): SpellReferenceOption[] {
  return items.map((item) => ({ value: item.id, label: item.label }))
}

function hasAbilityVocabulary(
  system: SystemAuthoredDto
): system is SystemAuthoredDto & { abilities: Array<{ id: string; label: string }> } {
  return 'abilities' in system && Array.isArray(system.abilities)
}

function toContentOptions(
  items: Array<ClassListItemDto | CreatureListItemDto>
): SpellReferenceOption[] {
  return items.map((item) => ({ value: item.id, label: item.label }))
}

function toMetaOptions(items: SpellListMetaGroup[] | undefined): SpellReferenceOption[] {
  return (items ?? []).map((item) => ({
    value: String(item.id),
    label: item.label ?? String(item.id)
  }))
}

export function getSpellDetailReferenceDataFromList(
  response: SpellListResponseDto
): SpellDetailReferenceData {
  const meta = response.meta as SpellListMeta

  return {
    magicSchools: toMetaOptions(meta.schools),
    classes: toMetaOptions(meta.classes),
    damageTypes: [],
    conditionTypes: []
  }
}

function emptySystem(): SystemAuthoredDto {
  return {
    id: 'default-system',
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

export function getSpellReferenceData(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.spells.referenceData(),
    queryFn: async (): Promise<SpellReferenceData> => {
      const systems = await client.systems.list()
      const systemId = systems[0]?.id ?? 'default-system'
      const [system, classes, creatures] = await Promise.all([
        systems[0] ? client.systems.get(systemId) : Promise.resolve(emptySystem()),
        loadPagedAuthoredCatalogItems(client.content.classes.list, {
          direction: 'FORWARD',
          limit: 48,
          sort: 'name'
        }),
        loadPagedAuthoredCatalogItems(client.content.creatures.list, {
          direction: 'FORWARD',
          limit: 48,
          sort: 'name'
        })
      ])

      const resolvedSystem = system ?? emptySystem()
      const effectReferences = buildEffectReferenceData(resolvedSystem, creatures)

      return {
        systemId: resolvedSystem.id,
        abilities: hasAbilityVocabulary(resolvedSystem)
          ? toVocabularyOptions(resolvedSystem.abilities)
          : [],
        magicSchools: toVocabularyOptions(resolvedSystem.magicSchools),
        classes: toContentOptions(classes),
        damageTypes: effectReferences.damageTypes,
        conditionTypes: effectReferences.conditionTypes,
        skills: toVocabularyOptions(resolvedSystem.skills),
        speeds: toVocabularyOptions(resolvedSystem.speeds),
        creatures: effectReferences.creatures
      }
    }
  })
}

export function getSpellDetailReferenceData(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.spells.detailReferenceData(),
    queryFn: async (): Promise<SpellDetailReferenceData> => {
      const systems = await client.systems.list()
      const systemId = systems[0]?.id ?? 'default-system'
      const [system, classes] = await Promise.all([
        systems[0] ? client.systems.get(systemId) : Promise.resolve(emptySystem()),
        loadPagedAuthoredCatalogItems(client.content.classes.list, {
          direction: 'FORWARD',
          limit: 48,
          sort: 'name'
        })
      ])

      const resolvedSystem = system ?? emptySystem()

      return {
        abilities: hasAbilityVocabulary(resolvedSystem)
          ? toVocabularyOptions(resolvedSystem.abilities)
          : [],
        magicSchools: toVocabularyOptions(resolvedSystem.magicSchools),
        classes: toContentOptions(classes),
        damageTypes: toVocabularyOptions(resolvedSystem.damageTypes),
        conditionTypes: toVocabularyOptions(resolvedSystem.conditionTypes)
      }
    }
  })
}

export function useGetSpellReferenceData() {
  return useSuspenseQuery(getSpellReferenceData())
}
