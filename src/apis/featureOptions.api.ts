import { getClient } from './utils'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { listFeatureOptions, listMasterFeatureOptions, getFeatureOption, getMasterFeatureOption } from '@/queries'
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
} from '@/mutations'

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

      const { client, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListFeatureOptionsArgs | QueryListMasterFeatureOptionsArgs

      const isMaster = (data: any): data is { listMasterFeatureOptions: any } => {
        return 'listMasterFeatureOptions' in data
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
          const { data } = await client.graphql({
            query: operation,
            variables: variables,
          })

          const result = isMaster(data) ? data.listMasterFeatureOptions : data.listFeatureOptions

          allData = { featureOptions: [...allData.featureOptions, ...result.items] }
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

export const fetchFeatureOption = (id: string) => {
  return queryOptions({
    queryKey: featureOptionsKeys.single(id),
    queryFn: async () => {
      const { client, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: any): data is { getMasterFeatureOption: any } {
        return 'getMasterFeatureOption' in data
      }

      const operation = master ? getMasterFeatureOption : getFeatureOption

      try {
        const { data } = await client.graphql({
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
        console.error({ err })
        throw err
      }
    },
  })
}

export const useAddNewFeatureOptionMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureOption, Error, FeatureOptionInput, unknown>({
    mutationFn: async (featureOption: FeatureOptionInput) => {
      const { client, master } = await getClient()

      const operation = master ? createMasterFeatureOption : createFeatureOption

      function isMaster(data: any): data is { createMasterFeatureOption: any } {
        return 'createMasterFeatureOption' in data
      }

      try {
        const { data } = await client.graphql({
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
        console.error({ err })
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

export const useUpdateFeatureOptionMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureOption, Error, FeatureOptionInput, unknown>({
    mutationFn: async (featureOption: FeatureOptionInput) => {
      const { client, master } = await getClient()

      const operation = master ? updateMasterFeatureOption : updateFeatureOption

      // Type guard to check which response we got
      function isMaster(data: any): data is { updateMasterFeatureOption: any } {
        return 'updateMasterFeatureOption' in data
      }

      try {
        const { data } = await client.graphql({
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
        console.error({ err })
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

export const useDeleteFeatureOptionMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { client, master } = await getClient()

      const operation = master ? deleteMasterFeatureOption : deleteFeatureOption

      // Type guard to check which response we got
      function isMaster(data: any): data is { deleteMasterFeatureOption: any } {
        return 'deleteMasterFeatureOption' in data
      }

      try {
        const { data } = await client.graphql({
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
        console.error({ err })
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
