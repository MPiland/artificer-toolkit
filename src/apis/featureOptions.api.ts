import { getClient } from './utils'
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { listFeatureOptions, listMasterFeatureOptions, getFeatureOption, getMasterFeatureOption } from '~/queries'
import type {
  FeatureOptionInput,
  FeatureOption,
  QueryListFeatureOptionsArgs,
  QueryListMasterFeatureOptionsArgs,
} from 'gql/types'
import {
  createFeatureOption,
  createMasterFeatureOption,
  updateFeatureOption,
  updateMasterFeatureOption,
  deleteMasterFeatureOption,
  deleteFeatureOption,
} from '~/mutations'
import { useSystemPref } from '~/hooks'

const featureOptionsKeys = {
  all: ['featureOptions'] as const,
  lists: () => [...featureOptionsKeys.all, 'list'] as const,
  single: (id: string) => [...featureOptionsKeys.all, 'single', id] as const,
}

export const fetchFeatureOptions = (systemPref: string) => {
  return queryOptions({
    queryKey: featureOptionsKeys.lists(),
    queryFn: async () => {
      let allData: { featureOptions: FeatureOption[] } = {
        featureOptions: [],
      }
      let nextToken: string | null = null

      const { featureClient, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListFeatureOptionsArgs | QueryListMasterFeatureOptionsArgs

      const isMaster = (data: unknown): data is { listMasterFeatureOptions: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterFeatureOptions' in data
      }

      const operation = master ? listMasterFeatureOptions : listFeatureOptions

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

          const result = isMaster(data) ? data.listMasterFeatureOptions : data.listFeatureOptions

          allData = { featureOptions: [...allData.featureOptions, ...result.items] }
          nextToken = result.nextToken || null
        } while (nextToken)

        if (allData.featureOptions.length) {
          allData.featureOptions.sort((a, b) => {
            if (a && b) {
              if (a.label && !b.label) {
                return -1
              }
              if (b.label && !a.label) {
                return 1
              }
              if (b.label && a.label) {
                return a.label.localeCompare(b.label)
              }
              return 0
            }
            if (a) {
              return -1
            }
            if (b) {
              return 1
            }
            return 0
          })
        }
        return allData
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const fetchFeatureOption = (id: string) => {
  return queryOptions({
    queryKey: featureOptionsKeys.single(id),
    queryFn: async () => {
      const { featureClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterFeatureOption: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterFeatureOption' in data
      }

      const operation = master ? getMasterFeatureOption : getFeatureOption

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterFeatureOption
        } else {
          return data.getFeatureOption
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const useListFeatureOptions = () => {
  const [systemPref] = useSystemPref()
  return useSuspenseQuery(fetchFeatureOptions(systemPref))
}

export const useGetFeatureOption = (id: string) => {
  return useSuspenseQuery(fetchFeatureOption(id))
}

export const useAddFeatureOption = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureOption, Error, FeatureOptionInput, unknown>({
    mutationFn: async (featureOption: FeatureOptionInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? createMasterFeatureOption : createFeatureOption

      function isMaster(data: unknown): data is { createMasterFeatureOption: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterFeatureOption' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: featureOption,
          },
        })

        if (isMaster(data)) {
          return data.createMasterFeatureOption
        } else {
          return data.createFeatureOption
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (featureOption: FeatureOption) => {
      queryClient.setQueryData(featureOptionsKeys.all, (previous: FeatureOption[]) => {
        if (!previous) return [featureOption]
        return [...previous, featureOption]
      })
    },
  })
}

export const useUpdateFeatureOption = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureOption, Error, FeatureOptionInput, unknown>({
    mutationFn: async (featureOption: FeatureOptionInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? updateMasterFeatureOption : updateFeatureOption

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterFeatureOption: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterFeatureOption' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: featureOption,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterFeatureOption
        } else {
          return data.updateFeatureOption
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (featureOption: FeatureOption) => {
      queryClient.setQueryData(featureOptionsKeys.all, (previous: FeatureOption[]) =>
        previous?.map((featureOptionKey) =>
          featureOptionKey.id === featureOption.id ? featureOption : featureOptionKey
        )
      )
    },
  })
}

export const useDeleteFeatureOption = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { featureClient, master } = await getClient()

      const operation = master ? deleteMasterFeatureOption : deleteFeatureOption

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterFeatureOption: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterFeatureOption' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterFeatureOption
        } else {
          return data.deleteFeatureOption
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(featureOptionsKeys.all, (previous: FeatureOption[]) => {
        const featureOption = previous.find((featureOptionKey) => featureOptionKey.id === id)
        if (featureOption) {
          return previous.filter((featureOptionKey) => featureOptionKey.id !== featureOption.id)
        }
      })
    },
  })
}
