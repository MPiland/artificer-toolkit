import { getClient } from './utils'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listFeatureModifiers,
  listMasterFeatureModifiers,
  getFeatureModifier,
  getMasterFeatureModifier,
} from '@/queries'
import type {
  FeatureModifierInput,
  FeatureModifier,
  QueryListFeatureModifiersArgs,
  QueryListMasterFeatureModifiersArgs,
} from 'gql/types'
import {
  createFeatureModifier,
  createMasterFeatureModifier,
  updateFeatureModifier,
  updateMasterFeatureModifier,
  deleteMasterFeatureModifier,
  deleteFeatureModifier,
} from '@/mutations'

const featureModifiersKeys = {
  all: ['featureModifiers'] as const,
  lists: () => [...featureModifiersKeys.all, 'list'] as const,
  single: (id: string) => [...featureModifiersKeys.all, 'single', id] as const,
}

export const fetchFeatureModifiers = (systemPref: string) => {
  return queryOptions({
    queryKey: featureModifiersKeys.lists(),
    queryFn: async () => {
      let allData: { featureModifiers: FeatureModifier[] } = {
        featureModifiers: [],
      }
      let nextToken: string | null = null

      const { featureClient, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListFeatureModifiersArgs | QueryListMasterFeatureModifiersArgs

      const isMaster = (data: unknown): data is { listMasterFeatureModifiers: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterFeatureModifiers' in data
      }

      const operation = master ? listMasterFeatureModifiers : listFeatureModifiers

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

          const result = isMaster(data) ? data.listMasterFeatureModifiers : data.listFeatureModifiers

          allData = { featureModifiers: [...allData.featureModifiers, ...result.items] }
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

export const fetchFeatureModifier = (id: string) => {
  return queryOptions({
    queryKey: featureModifiersKeys.single(id),
    queryFn: async () => {
      const { featureClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterFeatureModifier: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterFeatureModifier' in data
      }

      const operation = master ? getMasterFeatureModifier : getFeatureModifier

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterFeatureModifier
        } else {
          return data.getFeatureModifier
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const useAddNewFeatureModifierMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureModifier, Error, FeatureModifierInput, unknown>({
    mutationFn: async (featureModifier: FeatureModifierInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? createMasterFeatureModifier : createFeatureModifier

      function isMaster(data: unknown): data is { createMasterFeatureModifier: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterFeatureModifier' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: featureModifier,
          },
        })

        if (isMaster(data)) {
          return data.createMasterFeatureModifier
        } else {
          return data.createFeatureModifier
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (featureModifier: FeatureModifier) => {
      queryClient.setQueryData(featureModifiersKeys.all, (previous: FeatureModifier[]) => {
        if (!previous) return [featureModifier]
        return [...previous, featureModifier]
      })
    },
  })
}

export const useUpdateFeatureModifierMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureModifier, Error, FeatureModifierInput, unknown>({
    mutationFn: async (featureModifier: FeatureModifierInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? updateMasterFeatureModifier : updateFeatureModifier

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterFeatureModifier: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterFeatureModifier' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: featureModifier,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterFeatureModifier
        } else {
          return data.updateFeatureModifier
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (featureModifier: FeatureModifier) => {
      queryClient.setQueryData(featureModifiersKeys.all, (previous: FeatureModifier[]) =>
        previous?.map((featureModifierKey) =>
          featureModifierKey.id === featureModifier.id ? featureModifier : featureModifierKey
        )
      )
    },
  })
}

export const useDeleteFeatureModifierMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { featureClient, master } = await getClient()

      const operation = master ? deleteMasterFeatureModifier : deleteFeatureModifier

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterFeatureModifier: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterFeatureModifier' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterFeatureModifier
        } else {
          return data.deleteFeatureModifier
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(featureModifiersKeys.all, (previous: FeatureModifier[]) => {
        const featureModifier = previous.find((featureModifierKey) => featureModifierKey.id === id)
        if (featureModifier) {
          return previous.filter((featureModifierKey) => featureModifierKey.id !== featureModifier.id)
        }
      })
    },
  })
}
