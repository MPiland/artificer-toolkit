import { useMutation, useQueryClient, queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { supabase } from '~supabase'
import { useSystemPref } from '~hooks'
import type { QueryData } from '@supabase/supabase-js'
import { addTypename, aggregateMeta, WithTypename, type WithKind } from './utils'

const backgroundsKeys = {
  all: ['backgrounds'] as const,
  lists: () => [...backgroundsKeys.all, 'list'] as const,
  single: (id: string) => [...backgroundsKeys.all, 'single', id] as const,
}

export const getBackgroundListQuery = supabase.from('backgrounds').select(
  `id,
  label,
  description,
  details(*),
  userId:user_id,
  systemId:system_id,
  masterId:is_master`
)

export type BackgroundListItem = QueryData<typeof getBackgroundListQuery>[number]

export const getBackgroundQuery = supabase.from('backgrounds').select(`
    id,
    label,
    description,
    userId:user_id,
    systemId:system_id,
    masterId:is_master,
    details:details(*),
    equipment:starting_equipment(
      *,
      sets:starting_equipment_sets(
        *,
        groups:starting_equipment_groups(
          *,
          options:starting_equipment_options(*)
        )
      )
    ),
    proficiencies:subfeature_proficiencies(*),
    features:features(
      *,
      modifiers:subfeature_modifiers(*),
      proficiencies:subfeature_proficiencies(*),
      expertise:subfeature_expertise(*),
      senses:subfeature_senses(*),
      spells:subfeature_spells(*),
      options:subfeature_options(
        *,
        modifiers:subfeature_modifiers(*),
        proficiencies:subfeature_proficiencies(*),
        expertise:subfeature_expertise(*),
        senses:subfeature_senses(*),
        spells:subfeature_spells(*)
      )
    )
  `)

export type Background = WithTypename<QueryData<typeof getBackgroundQuery>[number], 'Background'>

export type BackgroundInput = WithKind<QueryData<typeof getBackgroundQuery>[number], 'Background'>

export type BackgroundMetaObject = { id: string; backgroundIds: string[] }
export type BackgroundMeta = { features: BackgroundMetaObject[] }

// Build BackgroundMeta from join table background_features, filtered by visible backgrounds
const computeBackgroundMeta = async (systemPref: string): Promise<BackgroundMeta> => {
  // Step 1: Resolve visible backgrounds (is_master = true OR system_id = systemPref)
  const { data: visibleBackgrounds, error: vErr } = await supabase
    .from('backgrounds')
    .select('id')
    .eq('system_id', systemPref)

  if (vErr) {
    console.log({ error: vErr })
    throw vErr
  }

  const visibleIds = (visibleBackgrounds ?? []).map((b) => b.id)
  if (visibleIds.length === 0) return { features: [] }

  // Step 2: Fetch join rows for only visible background_ids
  const { data, error } = await supabase
    .from('background_features')
    .select('feature_id, background_id')
    .in('background_id', visibleIds)

  if (error) {
    console.log({ error })
    throw error
  }

  const featureMetaMap = aggregateMeta('feature_id', 'background_id', data ?? [])

  const features: BackgroundMetaObject[] = Array.from(featureMetaMap.entries()).map(([id, set]) => ({
    id,
    backgroundIds: Array.from(set),
  }))

  return { features }
}

export const fetchBackgrounds = (systemPref: string) => {
  return queryOptions({
    queryKey: backgroundsKeys.lists(),
    queryFn: async (): Promise<{
      data: BackgroundListItem[]
      metaData: BackgroundMeta
    }> => {
      const { data, error } = await getBackgroundListQuery
        .eq('system_id', systemPref)
        .order('label', { ascending: true })

      if (error) {
        console.log({ error })
        throw error
      }

      const metaData = await computeBackgroundMeta(systemPref)
      return { data, metaData }
    },
  })
}

export const fetchBackground = (id: string) => {
  return queryOptions({
    queryKey: backgroundsKeys.single(id),
    queryFn: async (): Promise<{ data: Background }> => {
      const { data, error } = await getBackgroundQuery.eq('id', id).single()

      if (error) {
        console.log({ error })
        throw error
      }

      return { data: addTypename(data, 'Background') }
    },
  })
}

export const useListBackgrounds = () => {
  const [systemPref] = useSystemPref()
  return useSuspenseQuery(fetchBackgrounds(systemPref))
}

export const useGetBackground = (id: string) => {
  return useSuspenseQuery(fetchBackground(id))
}

export const useUpsertBackground = () => {
  const queryClient = useQueryClient()

  return useMutation<Background, Error, BackgroundInput, unknown>({
    mutationFn: async (background: BackgroundInput) => {
      const { error } = await supabase.rpc('upsert_backgrounds', {
        json_data: background,
      })

      if (error) {
        console.log(error)
        throw error
      }

      return addTypename(background, 'Background')
    },
    onSuccess: async (background: Background) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: backgroundsKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: backgroundsKeys.single(background.id),
        }),
      ])
    },
  })
}

export const useDeleteBackground = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('backgrounds').delete().eq('id', id)

      if (error) {
        console.log(error)
        throw error
      }
      return id
    },
    onSuccess: async (id: string) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: backgroundsKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: backgroundsKeys.single(id) }),
      ])
    },
  })
}
