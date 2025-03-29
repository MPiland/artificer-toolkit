import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listClasses, getClass, listMasterClasses, getMasterClass } from '../../amplify/gql/queries'
import {
  createClass,
  createMasterClass,
  deleteClass,
  deleteMasterClass,
  updateClass,
  updateMasterClass,
} from '../../amplify/gql/mutations'
import { Class, QueryListClassesArgs, QueryListMasterClassesArgs } from '../../amplify/gql/types'
import useSystemPref from '../hooks/useSystemPref'
import { Categories } from '../types/enums'
import { fetchAuthSession } from 'aws-amplify/auth'
import { removeTypename } from '../utils/form'

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

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { listMasterClasses: any } {
        return 'listMasterClasses' in data
      }

      const operation = master ? listMasterClasses : listClasses

      type ListVariables = QueryListMasterClassesArgs | QueryListClassesArgs

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

          const items = isMaster(data) ? data.listMasterClasses : data.listClasses
          allData = [...allData, ...items.items]
          nextToken = items?.nextToken || null
        } while (nextToken)

        if (filter) {
          const filteredItems = allData
            .filter((item) => item.category !== filter)
            .sort((a, b) => a.value.localeCompare(b.value))
          return filteredItems
        }

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

export const useGetClassQuery = (id: string) => {
  const query = useSuspenseQuery({
    queryKey: classesKeys.single(id),

    queryFn: async () => {
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { getMasterClass: any } {
        return 'getMasterClass' in data
      }

      const operation = master ? getMasterClass : getClass

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterClass
        } else {
          return data.getClass
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
  })

  return query
}

export const useAddNewClassMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Class, Error, Class, unknown>({
    mutationFn: async (uClass: Class) => {
      const cleanClass = removeTypename(uClass)

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { createMasterClass: any } {
        return 'createMasterClass' in data
      }

      const operation = master ? createMasterClass : createClass

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanClass,
          },
        })

        if (isMaster(data)) {
          return data.createMasterClass
        } else {
          return data.createClass
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
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

  return useMutation<Class, Error, Class, unknown>({
    mutationFn: async (uClass: Class) => {
      const cleanClass = removeTypename(uClass)

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { updateMasterClass: any } {
        return 'updateMasterClass' in data
      }

      const operation = master ? updateMasterClass : updateClass

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanClass,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterClass
        } else {
          return data.updateClass
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
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
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { deleteMasterClass: any } {
        return 'deleteMasterClass' in data
      }

      const operation = master ? deleteMasterClass : deleteClass

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterClass
        } else {
          return data.deleteClass
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(classesKeys.all, (previous: Class[]) => {
        const uClass = previous.find((classKey) => classKey.id === id)
        return previous.filter((classKey) => uClass && classKey.id !== uClass.id)
      })
    },
  })
}
