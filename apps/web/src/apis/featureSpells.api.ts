import { getClient } from './utils'
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { listFeatureSpells, listMasterFeatureSpells, getFeatureSpell, getMasterFeatureSpell } from '~queries'
import type {
  FeatureSpellInput,
  FeatureSpell,
  QueryListFeatureSpellsArgs,
  QueryListMasterFeatureSpellsArgs,
} from 'gql/types'
import {
  createFeatureSpell,
  createMasterFeatureSpell,
  updateFeatureSpell,
  updateMasterFeatureSpell,
  deleteMasterFeatureSpell,
  deleteFeatureSpell,
} from '~mutations'
import { useSystemPref } from '~hooks'

const featureSpellsKeys = {
  all: ['featureSpells'] as const,
  lists: () => [...featureSpellsKeys.all, 'list'] as const,
  single: (id: string) => [...featureSpellsKeys.all, 'single', id] as const,
}

export const fetchFeatureSpells = (systemPref: string) => {
  return queryOptions({
    queryKey: featureSpellsKeys.lists(),
    queryFn: async () => {
      let allData: { featureSpells: FeatureSpell[] } = {
        featureSpells: [],
      }
      let nextToken: string | null = null

      const { featureClient, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListFeatureSpellsArgs | QueryListMasterFeatureSpellsArgs

      const isMaster = (data: unknown): data is { listMasterFeatureSpells: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterFeatureSpells' in data
      }

      const operation = master ? listMasterFeatureSpells : listFeatureSpells

      let variables: ListVariables = {
        limit: 1000,
        nextToken,
      }

      if (!master) {
        variables = {
          ...variables,
          systemId: systemPref,
        }
      }

      try {
        do {
          const { data } = await featureClient.graphql({
            query: operation,
            variables: variables,
          })

          const result = isMaster(data) ? data.listMasterFeatureSpells : data.listFeatureSpells

          allData = { featureSpells: [...allData.featureSpells, ...result.items] }
          nextToken = result.nextToken || null
        } while (nextToken)

        return allData
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const fetchFeatureSpell = (id: string) => {
  return queryOptions({
    queryKey: featureSpellsKeys.single(id),
    queryFn: async () => {
      const { featureClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterFeatureSpell: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterFeatureSpell' in data
      }

      const operation = master ? getMasterFeatureSpell : getFeatureSpell

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterFeatureSpell
        } else {
          return data.getFeatureSpell
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const useListFeatureSpells = () => {
  const [systemPref] = useSystemPref()
  return useSuspenseQuery(fetchFeatureSpells(systemPref))
}

export const useGetFeatureSpell = (id: string) => {
  return useSuspenseQuery(fetchFeatureSpell(id))
}

export const useAddFeatureSpell = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureSpell, Error, FeatureSpellInput, unknown>({
    mutationFn: async (featureSpell: FeatureSpellInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? createMasterFeatureSpell : createFeatureSpell

      function isMaster(data: unknown): data is { createMasterFeatureSpell: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterFeatureSpell' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: featureSpell,
          },
        })

        if (isMaster(data)) {
          return data.createMasterFeatureSpell
        } else {
          return data.createFeatureSpell
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (featureSpell: FeatureSpell) => {
      queryClient.setQueryData(featureSpellsKeys.all, (previous: FeatureSpell[]) => {
        if (!previous) return [featureSpell]
        return [...previous, featureSpell]
      })
    },
  })
}

export const useUpdateFeatureSpell = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureSpell, Error, FeatureSpellInput, unknown>({
    mutationFn: async (featureSpell: FeatureSpellInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? updateMasterFeatureSpell : updateFeatureSpell

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterFeatureSpell: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterFeatureSpell' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: featureSpell,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterFeatureSpell
        } else {
          return data.updateFeatureSpell
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (featureSpell: FeatureSpell) => {
      queryClient.setQueryData(featureSpellsKeys.all, (previous: FeatureSpell[]) =>
        previous?.map((featureSpellKey) => (featureSpellKey.id === featureSpell.id ? featureSpell : featureSpellKey))
      )
    },
  })
}

export const useDeleteFeatureSpell = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { featureClient, master } = await getClient()

      const operation = master ? deleteMasterFeatureSpell : deleteFeatureSpell

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterFeatureSpell: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterFeatureSpell' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterFeatureSpell
        } else {
          return data.deleteFeatureSpell
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(featureSpellsKeys.all, (previous: FeatureSpell[]) => {
        const featureSpell = previous.find((featureSpellKey) => featureSpellKey.id === id)
        if (featureSpell) {
          return previous.filter((featureSpellKey) => featureSpellKey.id !== featureSpell.id)
        }
      })
    },
  })
}
