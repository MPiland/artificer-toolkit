import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listClasses, getClass, listMasterClasses } from '../../../amplify/gql/queries'
import { createClass, deleteClass, updateClass } from '../../../amplify/gql/mutations'
import { ClassInput, Class } from '../../../amplify/gql/types'
import useSystemPref from '../../hooks/useSystemPref'
import { Categories } from '../../types/enums'
import { fetchAuthSession } from 'aws-amplify/auth'

const client = generateClient()

const classesKeys = {
  all: ['classes'] as const,
  lists: () => [...classesKeys.all, 'list'] as const,
  single: (id: string) => [...classesKeys.all, 'single', id] as const,
}

export const useListClassesQuery = (filter?: Categories.base) => {
  const [systemPref] = useSystemPref()

  const query = useSuspenseQuery({
    queryKey: classesKeys.lists(),
    queryFn: async () => {
      let allData: Class[] = []
      let nextToken: string | null = null

      try {
        const { tokens } = await fetchAuthSession()
        const groups = tokens.accessToken?.payload?.['cognito:groups'] as string[]
        const master = groups?.includes('Admins') || false

        // Type guard to check which response we got
        function isMaster(data: any): data is { listMasterClasses: any } {
          return 'listMasterClasses' in data
        }

        const operation = master ? listMasterClasses : listClasses

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

          const items = isMaster(data) ? data.listMasterClasses : data.listClasses
          allData = [...allData, ...items.items]
          nextToken = items.nextToken
        } while (nextToken)

        if (filter) {
          const filteredItems = allData
            .filter((item) => item.category !== filter)
            .sort((a, b) => a.value.localeCompare(b.value))
          return filteredItems
        }

        if (allData && allData.length > 0) {
          return allData.sort((a, b) => a.value.localeCompare(b.value))
        }

        return null
      } catch (err) {
        console.log({ err })
      }
    },
  })

  return query
}

export const useGetClassQuery = (id: string) => {
  const query = useSuspenseQuery({
    queryKey: classesKeys.single(id),
    queryFn: async () => {
      try {
        const {
          data: { getClass: userClass },
        } = await client.graphql({
          query: getClass,
          variables: {
            id,
          },
        })
        return userClass
      } catch (err) {
        console.log({ err })
      }
    },
  })

  return query
}

export const useAddNewClassMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (uClass: ClassInput) => {
      const {
        data: { createClass: newClass },
      } = await client.graphql({
        query: createClass,
        variables: {
          input: uClass,
        },
      })

      return newClass
    },
    onSuccess: (uClass: Class) => {
      queryClient.setQueryData(classesKeys.all, (previous: Class[]) => {
        if (!previous) return [uClass]
        return [...previous, uClass]
      })
    },
  })
}

export const useUpdateClassMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (uClass: ClassInput) => {
      const {
        data: { updateClass: updatedClass },
      } = await client.graphql({
        query: updateClass,
        variables: {
          input: uClass,
        },
      })
      return updatedClass
    },
    onSuccess: (uClass: Class) => {
      queryClient.setQueryData(classesKeys.all, (previous: Class[]) =>
        previous.map((classKey) => (classKey.id === uClass.id ? uClass : classKey))
      )
    },
  })
}

export const useDeleteClassMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const {
        data: { deleteClass: deletedId },
      } = await client.graphql({
        query: deleteClass,
        variables: {
          id,
        },
      })

      return deletedId
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(classesKeys.all, (previous: Class[]) => {
        const uClass = previous.find((classKey) => classKey.id === id)
        return previous.filter((classKey) => classKey.id !== uClass.id)
      })
    },
  })
}
