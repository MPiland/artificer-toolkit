import { useMutation, useQueryClient, queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { type GraphQLResult } from 'aws-amplify/data'
import { getFeat, getMasterFeat, listFeats, listMasterFeats } from '../../gql/queries'
import {
  createFeat,
  createMasterFeat,
  deleteFeat,
  deleteMasterFeat,
  updateFeat,
  updateMasterFeat,
} from '../../gql/mutations'
import type {
  Feat,
  QueryListMasterFeatsArgs,
  QueryListFeatsArgs,
  FeatInput,
  FeatConnection,
  FeatListItem,
  FeatMeta,
} from '~/types'
import { getClient } from './utils'
import { useSystemPref } from '~/hooks'

const featsKeys = {
  all: ['feats'] as const,
  lists: () => [...featsKeys.all, 'list'] as const,
  single: (id: string) => [...featsKeys.all, 'single', id] as const,
}

export const fetchFeats = (systemPref: string) => {
  return queryOptions({
    queryKey: featsKeys.lists(),
    queryFn: async () => {
      let allData: { feats: FeatListItem[]; metaData: FeatMeta } = {
        feats: [],
        metaData: {} as FeatMeta,
      }
      let nextToken: string | null = null

      const { domainClient, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListMasterFeatsArgs | QueryListFeatsArgs

      const isMaster = (data: unknown): data is { listMasterFeats: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterFeats' in data
      }

      const operation = master ? listMasterFeats : listFeats

      type QueryResponse = { listMasterFeats: FeatConnection } | { listFeats: FeatConnection }

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
          const { data } = (await domainClient.graphql({
            query: operation,
            variables: variables,
          })) as GraphQLResult<QueryResponse>

          const result = isMaster(data) ? data.listMasterFeats : data.listFeats

          allData = { feats: [...allData.feats, ...result.items], metaData: result.metaData }
          nextToken = result.nextToken || null
        } while (nextToken)

        if (allData.feats.length) {
          allData.feats.sort((a, b) => {
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

export const fetchFeat = (id: string) => {
  return queryOptions({
    queryKey: featsKeys.single(id),
    queryFn: async () => {
      const { domainClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterFeat: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterFeat' in data
      }

      const operation = master ? getMasterFeat : getFeat

      try {
        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterFeat
        } else {
          return data.getFeat
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const useListFeats = () => {
  const [systemPref] = useSystemPref()
  return useSuspenseQuery(fetchFeats(systemPref))
}

export const useGetFeat = (id: string) => {
  return useSuspenseQuery(fetchFeat(id))
}

export const useAddFeat = () => {
  const queryClient = useQueryClient()

  return useMutation<Feat, Error, FeatInput, unknown>({
    mutationFn: async (feat: FeatInput) => {
      const { domainClient, master } = await getClient()

      const operation = master ? createMasterFeat : createFeat

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { createMasterFeat: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterFeat' in data
      }

      try {
        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            input: feat,
          },
        })

        if (isMaster(data)) {
          return data.createMasterFeat
        } else {
          return data.createFeat
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (feat: Feat) => {
      queryClient.setQueryData(featsKeys.all, (previous: Feat[]) => {
        if (!previous) return [feat]
        return [...previous, feat]
      })
    },
  })
}

export const useUpdateFeat = () => {
  const queryClient = useQueryClient()

  return useMutation<Feat, Error, FeatInput, unknown>({
    mutationFn: async (feat: FeatInput) => {
      const { domainClient, master } = await getClient()

      const operation = master ? updateMasterFeat : updateFeat

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterFeat: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterFeat' in data
      }

      try {
        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            input: feat,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterFeat
        } else {
          return data.updateFeat
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (feat: Feat) => {
      queryClient.setQueryData(featsKeys.all, (previous: Feat[]) =>
        previous.map((featKey) => (featKey.id === feat.id ? feat : featKey))
      )
    },
  })
}

export const useDeleteFeat = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { domainClient, master } = await getClient()

      const operation = master ? deleteMasterFeat : deleteFeat

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterFeat: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterFeat' in data
      }

      try {
        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterFeat
        } else {
          return data.deleteFeat
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(featsKeys.all, (previous: Feat[]) => {
        const feat = previous.find((featKey) => featKey.id === id)
        if (feat) {
          return previous.filter((featKey) => featKey.id !== feat.id)
        }
        return previous
      })
    },
  })
}
