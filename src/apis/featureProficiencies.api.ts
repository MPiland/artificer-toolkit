import { getClient } from './utils'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listFeatureProficiencies,
  listMasterFeatureProficiencies,
  getFeatureProficiency,
  getMasterFeatureProficiency,
} from '@/queries'
import type {
  FeatureProficiencyInput,
  FeatureProficiency,
  QueryListFeatureProficienciesArgs,
  QueryListMasterFeatureProficienciesArgs,
} from 'gql/types'
import {
  createFeatureProficiency,
  createMasterFeatureProficiency,
  updateFeatureProficiency,
  updateMasterFeatureProficiency,
  deleteMasterFeatureProficiency,
  deleteFeatureProficiency,
} from '@/mutations'

const featureProficienciesKeys = {
  all: ['featureProficiencies'] as const,
  lists: () => [...featureProficienciesKeys.all, 'list'] as const,
  single: (id: string) => [...featureProficienciesKeys.all, 'single', id] as const,
}

export const fetchFeatureProficiencies = (systemPref: string) => {
  return queryOptions({
    queryKey: featureProficienciesKeys.lists(),
    queryFn: async () => {
      let allData: { featureProficiencies: FeatureProficiency[] } = {
        featureProficiencies: [],
      }
      let nextToken: string | null = null

      const { featureClient, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListFeatureProficienciesArgs | QueryListMasterFeatureProficienciesArgs

      const isMaster = (data: unknown): data is { listMasterFeatureProficiencies: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterFeatureProficiencies' in data
      }

      const operation = master ? listMasterFeatureProficiencies : listFeatureProficiencies

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

          const result = isMaster(data) ? data.listMasterFeatureProficiencies : data.listFeatureProficiencies

          allData = { featureProficiencies: [...allData.featureProficiencies, ...result.items] }
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

export const fetchFeatureProficiency = (id: string) => {
  return queryOptions({
    queryKey: featureProficienciesKeys.single(id),
    queryFn: async () => {
      const { featureClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterFeatureProficiency: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterFeatureProficiency' in data
      }

      const operation = master ? getMasterFeatureProficiency : getFeatureProficiency

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterFeatureProficiency
        } else {
          return data.getFeatureProficiency
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
  })
}

export const useAddNewFeatureProficiencyMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureProficiency, Error, FeatureProficiencyInput, unknown>({
    mutationFn: async (featureProficiency: FeatureProficiencyInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? createMasterFeatureProficiency : createFeatureProficiency

      function isMaster(data: unknown): data is { createMasterFeatureProficiency: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterFeatureProficiency' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: featureProficiency,
          },
        })

        if (isMaster(data)) {
          return data.createMasterFeatureProficiency
        } else {
          return data.createFeatureProficiency
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (featureProficiency: FeatureProficiency) => {
      queryClient.setQueryData(featureProficienciesKeys.all, (previous: FeatureProficiency[]) => {
        if (!previous) return [featureProficiency]
        return [...previous, featureProficiency]
      })
    },
  })
}

export const useUpdateFeatureProficiencyMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureProficiency, Error, FeatureProficiencyInput, unknown>({
    mutationFn: async (featureProficiency: FeatureProficiencyInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? updateMasterFeatureProficiency : updateFeatureProficiency

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterFeatureProficiency: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterFeatureProficiency' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: featureProficiency,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterFeatureProficiency
        } else {
          return data.updateFeatureProficiency
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (featureProficiency: FeatureProficiency) => {
      queryClient.setQueryData(featureProficienciesKeys.all, (previous: FeatureProficiency[]) =>
        previous?.map((featureProficiencyKey) =>
          featureProficiencyKey.id === featureProficiency.id ? featureProficiency : featureProficiencyKey
        )
      )
    },
  })
}

export const useDeleteFeatureProficiencyMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { featureClient, master } = await getClient()

      const operation = master ? deleteMasterFeatureProficiency : deleteFeatureProficiency

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterFeatureProficiency: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterFeatureProficiency' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterFeatureProficiency
        } else {
          return data.deleteFeatureProficiency
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(featureProficienciesKeys.all, (previous: FeatureProficiency[]) => {
        const featureProficiency = previous.find((featureProficiencyKey) => featureProficiencyKey.id === id)
        if (featureProficiency) {
          return previous.filter((featureProficiencyKey) => featureProficiencyKey.id !== featureProficiency.id)
        }
      })
    },
  })
}
