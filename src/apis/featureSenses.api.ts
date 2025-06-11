import { getClient } from './utils'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { listFeatureSenses, listMasterFeatureSenses, getFeatureSense, getMasterFeatureSense } from '@/queries'
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
} from '@/mutations'

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

      const { client, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListFeatureSensesArgs | QueryListMasterFeatureSensesArgs

      const isMaster = (data: any): data is { listMasterFeatureSenses: any } => {
        return 'listMasterFeatureSenses' in data
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
          const { data } = await client.graphql({
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
      const { client, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: any): data is { getMasterFeatureSense: any } {
        return 'getMasterFeatureSense' in data
      }

      const operation = master ? getMasterFeatureSense : getFeatureSense

      try {
        const { data } = await client.graphql({
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
        console.error({ err })
        throw err
      }
    },
  })
}

export const useAddNewFeatureSenseMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureSense, Error, FeatureSenseInput, unknown>({
    mutationFn: async (featureSense: FeatureSenseInput) => {
      const { client, master } = await getClient()

      const operation = master ? createMasterFeatureSense : createFeatureSense

      function isMaster(data: any): data is { createMasterFeatureSense: any } {
        return 'createMasterFeatureSense' in data
      }

      try {
        const { data } = await client.graphql({
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
        console.error({ err })
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

export const useUpdateFeatureSenseMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureSense, Error, FeatureSenseInput, unknown>({
    mutationFn: async (featureSense: FeatureSenseInput) => {
      const { client, master } = await getClient()

      const operation = master ? updateMasterFeatureSense : updateFeatureSense

      // Type guard to check which response we got
      function isMaster(data: any): data is { updateMasterFeatureSense: any } {
        return 'updateMasterFeatureSense' in data
      }

      try {
        const { data } = await client.graphql({
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
        console.error({ err })
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

export const useDeleteFeatureSenseMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { client, master } = await getClient()

      const operation = master ? deleteMasterFeatureSense : deleteFeatureSense

      // Type guard to check which response we got
      function isMaster(data: any): data is { deleteMasterFeatureSense: any } {
        return 'deleteMasterFeatureSense' in data
      }

      try {
        const { data } = await client.graphql({
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
        console.error({ err })
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
