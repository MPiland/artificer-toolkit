import { useMutation, useQueryClient, queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { supabase } from '~supabase'
import { useSystemPref } from '~hooks'
import type { QueryData } from '@supabase/supabase-js'
import { addTypename, aggregateMeta, WithTypename, type WithKind } from './utils'

const classesKeys = {
  all: ['classes'] as const,
  lists: () => [...classesKeys.all, 'list'] as const,
  single: (id: string) => [...classesKeys.all, 'single', id] as const,
}

export const getClassListQuery = supabase.from('classes').select(
  `*,
  details(*)`
)

export type ClassListItem = QueryData<typeof getClassListQuery>[number]

export const getClassQuery = supabase.from('classes').select(`
  id,
  label,
  description,
  attributeIds: class_attributes(*),
  categoryId: category_id,
  details(*),
  hitpoint: class_hitpoint(
    abilityId: ability_id,
    dieConfig: die_config
  ),
  startingGold: class_starting_gold(
    multiplier,
    currencyId: currency_id,
    dieConfig: die_config
  ),
  equipment: starting_equipment(
    sets: starting_equipment_sets(
      position,
      groups: starting_equipment_groups(
        position,
        options: starting_equipment_options(
          position,
          items: starting_equipment_option_items(
            attributes: starting_equipment_option_item_attributes(*),
            selection_count,
            category_id,
            position,
            quantity,
            currencies: starting_equipment_option_item_currencies(*),
            properties: starting_equipment_option_item_properties(*),
            equipment: starting_equipment_option_item_equipment(*)
          )
        )
      )
    )
  ),
  proficiencies:subfeature_proficiencies(*),
  spellcasting: class_spellcasting(*),
  parentClassId: parent_class_id,
  subtypes: class_subtypes(*),
  features(*,
    modifiers:subfeature_modifiers(*),
    proficiencies:subfeature_proficiencies(*),
    expertise:subfeature_expertise(*),
    senses:subfeature_senses(*),
    spells:subfeature_spells(*),
    options:subfeature_options(*,
      modifiers:subfeature_modifiers(*),
      proficiencies:subfeature_proficiencies(*),
      expertise:subfeature_expertise(*),
      senses:subfeature_senses(*),
      spells:subfeature_spells(*)
    )
  ),
  userId:user_id,
  systemId:system_id,
  masterId:is_master
  `)

export type Class = WithTypename<QueryData<typeof getClassQuery>[number], 'Class'>

export type ClassInput = WithKind<QueryData<typeof getClassQuery>[number], 'Class'>

export type ClassMetaObject = { id: string; classIds: string[] }
export type ClassMeta = {
  features: ClassMetaObject[]
  categories: ClassMetaObject[]
  parentClasses?: ClassMetaObject[]
}

// Build ClassMeta (features, categories, parent classes) without top-level views
const computeClassMeta = async (systemPref: string): Promise<ClassMeta> => {
  // Visible classes for this system
  const { data: classesRows, error: vErr } = await supabase
    .from('classes')
    .select(`id, category_id, parent_class_id`)
    .eq('system_id', systemPref)

  if (vErr) {
    console.log({ error: vErr })
    throw vErr
  }

  const visibleIds = (classesRows ?? []).map((c) => c.id)
  if (visibleIds.length === 0) return { features: [], categories: [] }

  // Features meta from bridge
  const { data, error } = await supabase
    .from('class_features')
    .select('feature_id, class_id')
    .in('class_id', visibleIds)

  if (error) {
    console.log({ error })
    throw error
  }

  const featureMetaMap = aggregateMeta('feature_id', 'class_id', data ?? [])

  const features: ClassMetaObject[] = Array.from(featureMetaMap.entries()).map(([id, set]) => ({
    id,
    classIds: Array.from(set),
  }))

  // Categories meta from classes rows
  const byCategory = new Map<string, Set<string>>()
  for (const row of classesRows ?? []) {
    const categoryId = (row as { category_id: string | null }).category_id
    const classId = (row as { id: string }).id
    if (!categoryId) continue
    if (!byCategory.has(categoryId)) byCategory.set(categoryId, new Set())
    byCategory.get(categoryId)!.add(classId)
  }
  const categories: ClassMetaObject[] = Array.from(byCategory.entries()).map(([id, set]) => ({
    id,
    classIds: Array.from(set),
  }))

  // Parent classes meta (optional)
  const byParent = new Map<string, Set<string>>()
  for (const row of classesRows ?? []) {
    const parentId = (row as { parent_class_id: string | null }).parent_class_id
    const classId = (row as { id: string }).id
    if (!parentId) continue
    if (!byParent.has(parentId)) byParent.set(parentId, new Set())
    byParent.get(parentId)!.add(classId)
  }
  const parentClasses: ClassMetaObject[] = Array.from(byParent.entries()).map(([id, set]) => ({
    id,
    classIds: Array.from(set),
  }))

  return { features, categories, parentClasses }
}

export const fetchClasses = (systemPref: string) => {
  return queryOptions({
    queryKey: classesKeys.lists(),
    queryFn: async () => {
      const { data, error } = await getClassListQuery.eq('system_id', systemPref).order('label', { ascending: true })

      if (error) {
        console.log({ error })
        throw error
      }

      const metaData = addTypename(await computeClassMeta(systemPref), 'ClassMeta')
      return { data, metaData }
    },
  })
}

export const fetchClass = (id: string) => {
  return queryOptions({
    queryKey: classesKeys.single(id),
    queryFn: async () => {
      const { data, error } = await getClassQuery.eq('id', id).single()

      if (error) {
        console.log({ error })
        throw error
      }

      return { data: addTypename(data, 'Class') }
    },
  })
}

export const useListClasses = () => {
  const [systemPref] = useSystemPref()
  return useSuspenseQuery(fetchClasses(systemPref))
}

export const useGetClass = (id: string) => {
  return useSuspenseQuery(fetchClass(id))
}

export const useUpsertClass = () => {
  const queryClient = useQueryClient()

  return useMutation<Class, Error, ClassInput, unknown>({
    mutationFn: async (uClass: ClassInput) => {
      const { error } = await supabase.rpc('upsert_classes', {
        json_data: uClass,
      })

      if (error) {
        console.log(error)
        throw error
      }

      return addTypename(uClass, 'Class')
    },
    onSuccess: (uClass: Class) => {
      queryClient.setQueryData(classesKeys.all, (previous: Class[]) => {
        if (!previous) return [uClass]
        return [...previous, uClass]
      })
    },
  })
}

export const useDeleteClass = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', id)

      if (error) {
        console.log(error)
        throw error
      }
      return id
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(classesKeys.all, (previous: Class[]) => {
        const uClass = previous.find((classKey) => classKey.id === id)
        if (uClass) {
          return previous.filter((classKey) => classKey.id !== uClass.id)
        }
        return previous
      })
    },
  })
}
