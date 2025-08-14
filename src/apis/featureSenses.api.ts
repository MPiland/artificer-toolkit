import { getClient } from './utils'
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { listFeatureSenses, listMasterFeatureSenses, getFeatureSense, getMasterFeatureSense } from '~/queries'
import type {
  FeatureSenseInput,
  FeatureSense,
  QueryListFeatureSensesArgs,
  QueryListMasterFeatureSensesArgs,
} from 'gql/types'
import {
  createFeatureSense,
  createMasterFeatureSense,
  updateFeatureSense,
  updateMasterFeatureSense,
  deleteMasterFeatureSense,
  deleteFeatureSense,
} from '~/mutations'
import { useSystemPref } from '~/hooks'

const featureSensesKeys = {
  all: ['featureSenses'] as const,
  lists: () => [...featureSensesKeys.all, 'list'] as const,
  single: (id: string) => [...featureSensesKeys.all, 'single', id] as const,
}

export const fetchFeatureSenses = (systemPref: string) => {
  return queryOptions({
    queryKey: featureSensesKeys.lists(),
    queryFn: async () => {
      let allData: { featureSenses: FeatureSense[] } = {
        featureSenses: [],
      }
      let nextToken: string | null = null

      const { featureClient, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListFeatureSensesArgs | QueryListMasterFeatureSensesArgs

      const isMaster = (data: unknown): data is { listMasterFeatureSenses: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterFeatureSenses' in data
      }

      const operation = master ? listMasterFeatureSenses : listFeatureSenses

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

          const result = isMaster(data) ? data.listMasterFeatureSenses : data.listFeatureSenses

          allData = { featureSenses: [...allData.featureSenses, ...result.items] }
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

export const fetchFeatureSense = (id: string) => {
  return queryOptions({
    queryKey: featureSensesKeys.single(id),
    queryFn: async () => {
      const { featureClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterFeatureSense: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterFeatureSense' in data
      }

      const operation = master ? getMasterFeatureSense : getFeatureSense

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterFeatureSense
        } else {
          return data.getFeatureSense
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const useListFeatureSenses = () => {
  const [systemPref] = useSystemPref()
  return useSuspenseQuery(fetchFeatureSenses(systemPref))
}

export const useGetFeatureSense = (id: string) => {
  return useSuspenseQuery(fetchFeatureSense(id))
}

export const useAddFeatureSense = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureSense, Error, FeatureSenseInput, unknown>({
    mutationFn: async (featureSense: FeatureSenseInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? createMasterFeatureSense : createFeatureSense

      function isMaster(data: unknown): data is { createMasterFeatureSense: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterFeatureSense' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: featureSense,
          },
        })

        if (isMaster(data)) {
          return data.createMasterFeatureSense
        } else {
          return data.createFeatureSense
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (featureSense: FeatureSense) => {
      queryClient.setQueryData(featureSensesKeys.all, (previous: FeatureSense[]) => {
        if (!previous) return [featureSense]
        return [...previous, featureSense]
      })
    },
  })
}

export const useUpdateFeatureSense = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureSense, Error, FeatureSenseInput, unknown>({
    mutationFn: async (featureSense: FeatureSenseInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? updateMasterFeatureSense : updateFeatureSense

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterFeatureSense: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterFeatureSense' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: featureSense,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterFeatureSense
        } else {
          return data.updateFeatureSense
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (featureSense: FeatureSense) => {
      queryClient.setQueryData(featureSensesKeys.all, (previous: FeatureSense[]) =>
        previous?.map((featureSenseKey) => (featureSenseKey.id === featureSense.id ? featureSense : featureSenseKey))
      )
    },
  })
}

export const useDeleteFeatureSense = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { featureClient, master } = await getClient()

      const operation = master ? deleteMasterFeatureSense : deleteFeatureSense

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterFeatureSense: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterFeatureSense' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterFeatureSense
        } else {
          return data.deleteFeatureSense
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(featureSensesKeys.all, (previous: FeatureSense[]) => {
        const featureSense = previous.find((featureSenseKey) => featureSenseKey.id === id)
        if (featureSense) {
          return previous.filter((featureSenseKey) => featureSenseKey.id !== featureSense.id)
        }
      })
    },
  })
}
