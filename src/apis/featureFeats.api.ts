import { getClient } from './utils'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { listFeatureFeats, listMasterFeatureFeats, getFeatureFeat, getMasterFeatureFeat } from '@/queries'
import type {
  FeatureFeatInput,
  FeatureFeat,
  QueryListFeatureFeatsArgs,
  QueryListMasterFeatureFeatsArgs,
} from 'gql/types'
import {
  createFeatureFeat,
  createMasterFeatureFeat,
  updateFeatureFeat,
  updateMasterFeatureFeat,
  deleteMasterFeatureFeat,
  deleteFeatureFeat,
} from '@/mutations'

const featureFeatsKeys = {
  all: ['featureFeats'] as const,
  lists: () => [...featureFeatsKeys.all, 'list'] as const,
  single: (id: string) => [...featureFeatsKeys.all, 'single', id] as const,
}

export const fetchFeatureFeats = (systemPref: string) => {
  return queryOptions({
    queryKey: featureFeatsKeys.lists(),
    queryFn: async () => {
      let allData: { featureFeats: FeatureFeat[] } = {
        featureFeats: [],
      }
      let nextToken: string | null = null

      const { featureClient, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListFeatureFeatsArgs | QueryListMasterFeatureFeatsArgs

      const isMaster = (data: unknown): data is { listMasterFeatureFeats: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterFeatureFeats' in data
      }

      const operation = master ? listMasterFeatureFeats : listFeatureFeats

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

          const result = isMaster(data) ? data.listMasterFeatureFeats : data.listFeatureFeats

          allData = { featureFeats: [...allData.featureFeats, ...result.items] }
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

export const fetchFeatureFeat = (id: string) => {
  return queryOptions({
    queryKey: featureFeatsKeys.single(id),
    queryFn: async () => {
      const { featureClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterFeatureFeat: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterFeatureFeat' in data
      }

      const operation = master ? getMasterFeatureFeat : getFeatureFeat

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterFeatureFeat
        } else {
          return data.getFeatureFeat
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const useAddNewFeatureFeatMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureFeat, Error, FeatureFeatInput, unknown>({
    mutationFn: async (featureFeat: FeatureFeatInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? createMasterFeatureFeat : createFeatureFeat

      function isMaster(data: unknown): data is { createMasterFeatureFeat: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterFeatureFeat' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: featureFeat,
          },
        })

        if (isMaster(data)) {
          return data.createMasterFeatureFeat
        } else {
          return data.createFeatureFeat
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (featureFeat: FeatureFeat) => {
      queryClient.setQueryData(featureFeatsKeys.all, (previous: FeatureFeat[]) => {
        if (!previous) return [featureFeat]
        return [...previous, featureFeat]
      })
    },
  })
}

export const useUpdateFeatureFeatMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureFeat, Error, FeatureFeatInput, unknown>({
    mutationFn: async (featureFeat: FeatureFeatInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? updateMasterFeatureFeat : updateFeatureFeat

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterFeatureFeat: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterFeatureFeat' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: featureFeat,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterFeatureFeat
        } else {
          return data.updateFeatureFeat
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (featureFeat: FeatureFeat) => {
      queryClient.setQueryData(featureFeatsKeys.all, (previous: FeatureFeat[]) =>
        previous?.map((featureFeatKey) => (featureFeatKey.id === featureFeat.id ? featureFeat : featureFeatKey))
      )
    },
  })
}

export const useDeleteFeatureFeatMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { featureClient, master } = await getClient()

      const operation = master ? deleteMasterFeatureFeat : deleteFeatureFeat

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterFeatureFeat: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterFeatureFeat' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterFeatureFeat
        } else {
          return data.deleteFeatureFeat
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(featureFeatsKeys.all, (previous: FeatureFeat[]) => {
        const featureFeat = previous.find((featureFeatKey) => featureFeatKey.id === id)
        if (featureFeat) {
          return previous.filter((featureFeatKey) => featureFeatKey.id !== featureFeat.id)
        }
      })
    },
  })
}
