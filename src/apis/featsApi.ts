import { useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { generateClient, type GraphQLResult } from 'aws-amplify/data'
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
} from '@/types'
import { fetchAuthSession } from 'aws-amplify/auth'
import { removeTypename } from '@/components/Form'

const client = generateClient()

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

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Create a union type for the variables
      type ListVariables = QueryListMasterFeatsArgs | QueryListFeatsArgs

      const isMaster = (data: any): data is { listMasterFeats: any } => {
        return 'listMasterFeats' in data
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
          const { data } = (await client.graphql({
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
              return a.value.localeCompare(b.value)
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
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { getMasterFeat: any } {
        return 'getMasterFeat' in data
      }

      const operation = master ? getMasterFeat : getFeat

      try {
        const { data } = await client.graphql({
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
        console.error({ err })
        throw err
      }
    },
  })
}

export const useAddNewFeatMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Feat, Error, Feat, unknown>({
    mutationFn: async (feat: Feat) => {
      const cleanFeat = removeTypename(feat) as FeatInput

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? createMasterFeat : createFeat

      // Type guard to check which response we got
      function isMaster(data: any): data is { createMasterFeat: any } {
        return 'createMasterFeat' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanFeat,
          },
        })

        if (isMaster(data)) {
          return data.createMasterFeat
        } else {
          return data.createFeat
        }
      } catch (err) {
        console.error({ err })
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

export const useUpdateFeatMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Feat, Error, Feat, unknown>({
    mutationFn: async (feat: Feat) => {
      const cleanFeat = removeTypename(feat) as FeatInput

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? updateMasterFeat : updateFeat

      // Type guard to check which response we got
      function isMaster(data: any): data is { updateMasterFeat: any } {
        return 'updateMasterFeat' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanFeat,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterFeat
        } else {
          return data.updateFeat
        }
      } catch (err) {
        console.error({ err })
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

export const useDeleteFeatMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? deleteMasterFeat : deleteFeat

      // Type guard to check which response we got
      function isMaster(data: any): data is { deleteMasterFeat: any } {
        return 'deleteMasterFeat' in data
      }

      try {
        const { data } = await client.graphql({
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
        console.error({ err })
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
