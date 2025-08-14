import { getClient } from './utils'
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { listAncestryOptions, listMasterAncestryOptions, getAncestryOption, getMasterAncestryOption } from '~/queries'
import type {
  AncestryOptionInput,
  AncestryOption,
  QueryListAncestryOptionsArgs,
  QueryListMasterAncestryOptionsArgs,
} from 'gql/types'
import {
  createAncestryOption,
  createMasterAncestryOption,
  updateAncestryOption,
  updateMasterAncestryOption,
  deleteMasterAncestryOption,
  deleteAncestryOption,
} from '~/mutations'
import { useSystemPref } from '~/hooks'
import request from 'graphql-request'

const ancestryOptionsKeys = {
  all: ['ancestryOptions'] as const,
  lists: () => [...ancestryOptionsKeys.all, 'list'] as const,
  single: (id: string) => [...ancestryOptionsKeys.all, 'single', id] as const,
}

export const fetchAncestryOptions = (systemPref: string) => {
  return queryOptions({
    queryKey: ancestryOptionsKeys.lists(),
    queryFn: async () => {
      const { featureEndpoint, master } = await getClient()
      if (!featureEndpoint) return []
      let allData: { ancestryOptions: AncestryOption[] } = {
        ancestryOptions: [],
      }
      let nextToken: string | null = null

      // Create a union type for the variables
      type ListVariables = QueryListAncestryOptionsArgs | QueryListMasterAncestryOptionsArgs

      const isMaster = (data: unknown): data is { listMasterAncestryOptions: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterAncestryOptions' in data
      }

      const operation = master ? listMasterAncestryOptions : listAncestryOptions

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
          const { data } = await request<(typeof operation)['__generatedQueryOutput']>(
            featureEndpoint,
            master ? listMasterAncestryOptions : listAncestryOptions,
            variables
          )

          const result = isMaster(data) ? data.listMasterAncestryOptions : data.listAncestryOptions

          allData = { ancestryOptions: [...allData.ancestryOptions, ...result.items] }
          nextToken = result.nextToken || null
        } while (nextToken)

        if (allData.ancestryOptions.length) {
          allData.ancestryOptions.sort((a, b) => {
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

export const fetchAncestryOption = (id: string) => {
  return queryOptions({
    queryKey: ancestryOptionsKeys.single(id),
    queryFn: async () => {
      const { featureClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterAncestryOption: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterAncestryOption' in data
      }

      const operation = master ? getMasterAncestryOption : getAncestryOption

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterAncestryOption
        } else {
          return data.getAncestryOption
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const useListAncestryOptions = () => {
  const [systemPref] = useSystemPref()
  return useSuspenseQuery(fetchAncestryOptions(systemPref))
}

export const useGetAncestryOption = (id: string) => {
  return useSuspenseQuery(fetchAncestryOption(id))
}

export const useAddAncestryOption = () => {
  const queryClient = useQueryClient()

  return useMutation<AncestryOption, Error, AncestryOptionInput, unknown>({
    mutationFn: async (ancestryOption: AncestryOptionInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? createMasterAncestryOption : createAncestryOption

      function isMaster(data: unknown): data is { createMasterAncestryOption: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterAncestryOption' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: ancestryOption,
          },
        })

        if (isMaster(data)) {
          return data.createMasterAncestryOption
        } else {
          return data.createAncestryOption
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (ancestryOption: AncestryOption) => {
      queryClient.setQueryData(ancestryOptionsKeys.all, (previous: AncestryOption[]) => {
        if (!previous) return [ancestryOption]
        return [...previous, ancestryOption]
      })
    },
  })
}

export const useUpdateAncestryOption = () => {
  const queryClient = useQueryClient()

  return useMutation<AncestryOption, Error, AncestryOptionInput, unknown>({
    mutationFn: async (ancestryOption: AncestryOptionInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? updateMasterAncestryOption : updateAncestryOption

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterAncestryOption: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterAncestryOption' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: ancestryOption,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterAncestryOption
        } else {
          return data.updateAncestryOption
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (ancestryOption: AncestryOption) => {
      queryClient.setQueryData(ancestryOptionsKeys.all, (previous: AncestryOption[]) =>
        previous?.map((ancestryOptionKey) =>
          ancestryOptionKey.id === ancestryOption.id ? ancestryOption : ancestryOptionKey
        )
      )
    },
  })
}

export const useDeleteAncestryOption = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { featureClient, master } = await getClient()

      const operation = master ? deleteMasterAncestryOption : deleteAncestryOption

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterAncestryOption: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterAncestryOption' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterAncestryOption
        } else {
          return data.deleteAncestryOption
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(ancestryOptionsKeys.all, (previous: AncestryOption[]) => {
        const ancestryOption = previous.find((ancestryOptionKey) => ancestryOptionKey.id === id)
        if (ancestryOption) {
          return previous.filter((ancestryOptionKey) => ancestryOptionKey.id !== ancestryOption.id)
        }
      })
    },
  })
}
