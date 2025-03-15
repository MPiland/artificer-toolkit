import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listBackgrounds, listMasterBackgrounds } from '../../../amplify/gql/queries'
import { createBackground, deleteBackground, updateBackground } from '../../../amplify/gql/mutations'
import { BackgroundInput, Background } from '../../../amplify/gql/types'
import useSystemPref from '../../hooks/useSystemPref'
import { fetchAuthSession } from 'aws-amplify/auth'

const client = generateClient()

const backgroundsKeys = {
  all: ['backgrounds'] as const,
  lists: () => [...backgroundsKeys.all, 'list'] as const,
  single: (id: string) => [...backgroundsKeys.all, 'single', id] as const,
}

export const useListBackgroundsQuery = () => {
  const [systemPref] = useSystemPref()

  const query = useSuspenseQuery({
    queryKey: backgroundsKeys.lists(),
    queryFn: async () => {
      let allData: Background[] = []
      let nextToken: string | null = null

      try {
        const { tokens } = await fetchAuthSession()
        const groups = tokens.accessToken?.payload?.['cognito:groups'] as string[]
        const master = groups?.includes('Admins') || false

        // Type guard to check which response we got
        function isMaster(data: any): data is { listMasterBackgrounds: any } {
          return 'listMasterBackgrounds' in data
        }

        const operation = master ? listMasterBackgrounds : listBackgrounds

        const variables: Record<string, any> = {
          limit: 1000,
          nextToken,
        }

        if (!master) {
          variables.systemId = systemPref
        }

        do {
          const { data } = await client.graphql({
            query: operation,
            variables: variables,
          })

          // Use type guard to determine which property to access
          const systems = isMaster(data) ? data.listMasterBackgrounds : data.listBackgrounds
          allData = [...allData, ...systems.items]
          nextToken = systems.nextToken
        } while (nextToken)

        if (allData && allData.length > 0) {
          return allData.sort((a, b) => a.value.localeCompare(b.value))
        }

        return null
      } catch (error) {
        console.error('Error fetching systems:', error)
        throw error
      }
    },
  })

  return query
}

export const useAddNewBackgroundMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (background: BackgroundInput) => {
      const {
        data: { createBackground: newBackground },
      } = await client.graphql({
        query: createBackground,
        variables: {
          input: background,
        },
      })

      return newBackground
    },
    onSuccess: (background: Background) => {
      queryClient.setQueryData(backgroundsKeys.all, (previous: Background[]) => {
        if (!previous) return [background]
        return [...previous, background]
      })
    },
  })
}

export const useUpdateBackgroundMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (background: BackgroundInput) => {
      const {
        data: { updateBackground: updatedBackground },
      } = await client.graphql({
        query: updateBackground,
        variables: {
          input: background,
        },
      })
      return updatedBackground
    },
    onSuccess: (background: Background) => {
      queryClient.setQueryData(backgroundsKeys.all, (previous: Background[]) =>
        previous.map((backgroundKey) => (backgroundKey.id === background.id ? background : backgroundKey))
      )
    },
  })
}

export const useDeleteBackgroundMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const {
        data: { deleteBackground: deletedId },
      } = await client.graphql({
        query: deleteBackground,
        variables: {
          id,
        },
      })

      return deletedId
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(backgroundsKeys.all, (previous: Background[]) => {
        const background = previous.find((backgroundKey) => backgroundKey.id === id)
        return previous.filter((backgroundKey) => backgroundKey.id !== background.id)
      })
    },
  })
}
