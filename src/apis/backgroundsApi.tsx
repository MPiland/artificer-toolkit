import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listMasterBackgrounds, listBackgrounds } from '../../amplify/gql/queries'
import {
  createMasterBackground,
  createBackground,
  deleteMasterBackground,
  deleteBackground,
  updateMasterBackground,
  updateBackground,
} from '../../amplify/gql/mutations'
import {
  BackgroundInput,
  Background,
  QueryListMasterBackgroundsArgs,
  QueryListBackgroundsArgs,
} from '../../amplify/gql/types'
import useSystemPref from '../hooks/useSystemPref'
import { fetchAuthSession } from 'aws-amplify/auth'
import { removeTypename } from '../utils/form'

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

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { listMasterBackgrounds: any } {
        return 'listMasterBackgrounds' in data
      }

      const operation = master ? listMasterBackgrounds : listBackgrounds // Create a union type for the variables

      type ListVariables = QueryListMasterBackgroundsArgs | QueryListBackgroundsArgs

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

          const items = isMaster(data) ? data.listMasterBackgrounds : data.listBackgrounds

          allData = [...allData, ...items.items]
          nextToken = items.nextToken || null
        } while (nextToken)

        if (allData.length) {
          return allData.sort((a, b) => a.value.localeCompare(b.value))
        }

        return []
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })

  return query
}

export const useAddNewBackgroundMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Background, Error, Background, unknown>({
    mutationFn: async (background: Background) => {
      const cleanBackground = removeTypename(background)

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? createMasterBackground : createBackground

      // Type guard to check which response we got
      function isMaster(data: any): data is { createMasterBackground: any } {
        return 'createMasterBackground' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanBackground,
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

export const useUpdateBackgroundMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Background, Error, Background, unknown>({
    mutationFn: async (background: Background) => {
      // Remove __typename fields from the background object
      const cleanBackground: BackgroundInput = removeTypename(background)
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? updateMasterBackground : updateBackground

      // Type guard to check which response we got
      function isMaster(data: any): data is { updateMasterBackground: any } {
        return 'updateMasterBackground' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanBackground,
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

export const useDeleteBackgroundMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? deleteMasterBackground : deleteBackground

      // Type guard to check which response we got
      function isMaster(data: any): data is { deleteMasterBackground: any } {
        return 'deleteMasterBackground' in data
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
