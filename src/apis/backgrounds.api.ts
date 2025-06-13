import { useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { type GraphQLResult } from 'aws-amplify/data'
import { listMasterBackgrounds, listBackgrounds, getMasterBackground, getBackground } from '@/queries'
import {
  createMasterBackground,
  createBackground,
  deleteMasterBackground,
  deleteBackground,
  updateMasterBackground,
  updateBackground,
} from '@/mutations'
import type {
  BackgroundInput,
  Background,
  QueryListMasterBackgroundsArgs,
  QueryListBackgroundsArgs,
  BackgroundConnection,
  BackgroundListItem,
  BackgroundMeta,
} from '@/types'
import { getClient } from './utils'

const backgroundsKeys = {
  all: ['backgrounds'] as const,
  lists: () => [...backgroundsKeys.all, 'list'] as const,
  single: (id: string) => [...backgroundsKeys.all, 'single', id] as const,
}

export const fetchBackgrounds = (systemPref: string) => {
  return queryOptions({
    queryKey: backgroundsKeys.lists(),
    queryFn: async () => {
      let allData: { backgrounds: BackgroundListItem[]; metaData: BackgroundMeta } = {
        backgrounds: [],
        metaData: {} as BackgroundMeta,
      }
      let nextToken: string | null = null

      const { client, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListMasterBackgroundsArgs | QueryListBackgroundsArgs

      const isMaster = (data: unknown): data is { listMasterBackgrounds: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterBackgrounds' in data
      }

      const operation = master ? listMasterBackgrounds : listBackgrounds

      type QueryResponse = { listBackgrounds: BackgroundConnection } | { listMasterBackgrounds: BackgroundConnection }

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
          const { data } = (await client.graphql({
            query: operation,
            variables: variables,
          })) as GraphQLResult<QueryResponse>

          const result = isMaster(data) ? data.listMasterBackgrounds : data.listBackgrounds

          allData = { backgrounds: [...allData.backgrounds, ...result.items], metaData: result.metaData }
          nextToken = result.nextToken || null
        } while (nextToken)

        if (allData.backgrounds.length) {
          allData.backgrounds.sort((a, b) => {
            if (a && b) {
              return a.label.localeCompare(b.label)
            }
            if (a) {
              return -1
            }
            return 1
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

export const fetchBackground = (id: string) => {
  return queryOptions({
    queryKey: backgroundsKeys.single(id),
    queryFn: async () => {
      const { client, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterBackground: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterBackground' in data
      }

      const operation = master ? getMasterBackground : getBackground

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterBackground
        } else {
          return data.getBackground
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
  })
}

export const useAddBackground = () => {
  const queryClient = useQueryClient()

  return useMutation<Background, Error, BackgroundInput, unknown>({
    mutationFn: async (background: BackgroundInput) => {
      const { client, master } = await getClient()

      const operation = master ? createMasterBackground : createBackground

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { createMasterBackground: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterBackground' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: background,
          },
        })

        if (isMaster(data)) {
          return data.createMasterBackground
        } else {
          return data.createBackground
        }
      } catch (err) {
        console.error(err)
        throw err
      }
    },
    onSuccess: (background: Background) => {
      queryClient.setQueryData(backgroundsKeys.all, (previous: Background[]) => {
        if (!previous) return [background]
        return [...previous, background]
      })
    },
  })
}

export const useUpdateBackground = () => {
  const queryClient = useQueryClient()

  return useMutation<Background, Error, BackgroundInput, unknown>({
    mutationFn: async (background: BackgroundInput) => {
      const { client, master } = await getClient()

      const operation = master ? updateMasterBackground : updateBackground

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterBackground: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterBackground' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: background,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterBackground
        } else {
          return data.updateBackground
        }
      } catch (err) {
        console.error(err)
        throw err
      }
    },
    onSuccess: (background: Background) => {
      queryClient.setQueryData(backgroundsKeys.all, (previous: Background[]) =>
        previous?.map((backgroundKey) => (backgroundKey.id === background.id ? background : backgroundKey))
      )
    },
  })
}

export const useDeleteBackground = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { client, master } = await getClient()

      const operation = master ? deleteMasterBackground : deleteBackground

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterBackground: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterBackground' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterBackground
        } else {
          return data.deleteBackground
        }
      } catch (err) {
        console.error(err)
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(backgroundsKeys.all, (previous: Background[]) => {
        const background = previous.find((backgroundKey) => backgroundKey.id === id)
        if (background) {
          return previous.filter((backgroundKey) => backgroundKey.id !== background.id)
        }
        return previous
      })
    },
  })
}
