import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listFeats, listMasterFeats } from '../../amplify/gql/queries'
import {
  createFeat,
  createMasterFeat,
  deleteFeat,
  deleteMasterFeat,
  updateFeat,
  updateMasterFeat,
} from '../../amplify/gql/mutations'
import { Feat, QueryListMasterFeatsArgs, QueryListFeatsArgs, type FeatInput } from '../../amplify/gql/types'
import useSystemPref from '../hooks/useSystemPref'
import { fetchAuthSession } from 'aws-amplify/auth'
import { removeTypename } from '../utils/form'

const client = generateClient()

const featsKeys = {
  all: ['feats'] as const,
  lists: () => [...featsKeys.all, 'list'] as const,
  single: (id: string) => [...featsKeys.all, 'single', id] as const,
}

export const useListFeatsQuery = () => {
  const [systemPref] = useSystemPref()

  const query = useSuspenseQuery({
    queryKey: featsKeys.lists(),
    queryFn: async () => {
      let allData: Feat[] = []
      let nextToken: string | null = null

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { listMasterFeats: any } {
        return 'listMasterFeats' in data
      }

      const operation = master ? listMasterFeats : listFeats

      type ListVariables = QueryListMasterFeatsArgs | QueryListFeatsArgs

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

          const items = isMaster(data) ? data.listMasterFeats : data.listFeats
          allData = [...allData, ...items.items]
          nextToken = items.nextToken || null
        } while (nextToken)

        if (allData.length) {
          return allData.sort((a, b) => a.value.localeCompare(b.value))
        }

        return []
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
  })

  return query
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
