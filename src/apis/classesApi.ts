import { useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { generateClient, type GraphQLResult } from 'aws-amplify/data'
import { listClasses, getClass, listMasterClasses, getMasterClass } from '../../amplify/gql/queries'
import {
  createClass,
  createMasterClass,
  deleteClass,
  deleteMasterClass,
  updateClass,
  updateMasterClass,
} from '../../amplify/gql/mutations'
import type {
  Class,
  QueryListClassesArgs,
  QueryListMasterClassesArgs,
  ClassInput,
  ClassListItem,
  ClassMeta,
  ClassConnection,
} from '@/types'
import { fetchAuthSession } from 'aws-amplify/auth'
import { removeTypename } from '@/components/Form'

const client = generateClient()

const classesKeys = {
  all: ['classes'] as const,
  lists: () => [...classesKeys.all, 'list'] as const,
  single: (id: string) => [...classesKeys.all, 'single', id] as const,
}

export const fetchClasses = (systemPref: string) => {
  return queryOptions({
    queryKey: classesKeys.lists(),
    queryFn: async () => {
      let allData: { classes: ClassListItem[]; metaData: ClassMeta } = {
        classes: [],
        metaData: {} as ClassMeta,
      }
      let nextToken: string | null = null

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Create a union type for the variables
      type ListVariables = QueryListMasterClassesArgs | QueryListClassesArgs

      const isMaster = (data: any): data is { listMasterClasses: any } => {
        return 'listMasterClasses' in data
      }

      const operation = master ? listMasterClasses : listClasses

      type QueryResponse = { listClasses: ClassConnection } | { listMasterClasses: ClassConnection }

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

          const result = isMaster(data) ? data.listMasterClasses : data.listClasses

          allData = {
            classes: [...allData.classes, ...result.items],
            metaData: result.metaData,
          }
          nextToken = result?.nextToken || null
        } while (nextToken)

        if (allData.classes.length) {
          allData.classes.sort((a, b) => {
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
        console.error({ err })
        throw err
      }
    },
  })
}

export const fetchClass = (id: string) => {
  return queryOptions({
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
}

export const useAddClass = () => {
  const queryClient = useQueryClient()

  return useMutation<Class, Error, Class, unknown>({
    mutationFn: async (uClass: Class) => {
      const cleanClass = removeTypename(uClass) as ClassInput

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

export const useUpdateClass = () => {
  const queryClient = useQueryClient()

  return useMutation<Class, Error, Class, unknown>({
    mutationFn: async (uClass: Class) => {
      const cleanClass = removeTypename(uClass) as ClassInput

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

export const useDeleteClass = () => {
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
