import { useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { type GraphQLResult } from 'aws-amplify/data'
import { listClasses, getClass, listMasterClasses, getMasterClass } from '@/queries'
import {
  createClass,
  createMasterClass,
  deleteClass,
  deleteMasterClass,
  updateClass,
  updateMasterClass,
} from '@/mutations'
import type {
  Class,
  QueryListClassesArgs,
  QueryListMasterClassesArgs,
  ClassInput,
  ClassListItem,
  ClassMeta,
  ClassConnection,
} from '@/types'
import { getClient } from './utils'

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

      const { domainClient, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListMasterClassesArgs | QueryListClassesArgs

      const isMaster = (data: unknown): data is { listMasterClasses: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterClasses' in data
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
          const { data } = (await domainClient.graphql({
            query: operation,
            variables: variables,
          })) as GraphQLResult<QueryResponse>

          console.log({ data })

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
      const { domainClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterClass: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterClass' in data
      }

      const operation = master ? getMasterClass : getClass

      try {
        const { data } = await domainClient.graphql({
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

export const useAddNewClassMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Class, Error, ClassInput, unknown>({
    mutationFn: async (uClass: ClassInput) => {
      const { domainClient, master } = await getClient()

      const operation = master ? createMasterClass : createClass

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { createMasterClass: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterClass' in data
      }

      try {
        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            input: uClass,
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

  return useMutation<Class, Error, ClassInput, unknown>({
    mutationFn: async (uClass: ClassInput) => {
      const { domainClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterClass: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterClass' in data
      }

      const operation = master ? updateMasterClass : updateClass

      try {
        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            input: uClass,
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
      const { domainClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterClass: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterClass' in data
      }

      const operation = master ? deleteMasterClass : deleteClass

      try {
        const { data } = await domainClient.graphql({
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
        if (uClass) {
          return previous.filter((classKey) => classKey.id !== uClass.id)
        }
        return previous
      })
    },
  })
}
