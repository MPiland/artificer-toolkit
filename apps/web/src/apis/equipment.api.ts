import { useMutation, useQueryClient, queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { type GraphQLResult } from 'aws-amplify/data'
import { getEquipment, getMasterEquipment, listEquipment, listMasterEquipment } from '~queries'
import {
  createEquipment,
  createMasterEquipment,
  deleteEquipment,
  deleteMasterEquipment,
  updateEquipment,
  updateMasterEquipment,
} from '~mutations'
import type {
  Equipment,
  QueryListMasterEquipmentArgs,
  QueryListEquipmentArgs,
  EquipmentInput,
  EquipmentConnection,
  EquipmentListItem,
  EquipmentMeta,
} from '~types'
import { getClient } from './utils'
import { useSystemPref } from '~hooks'

const equipmentKeys = {
  all: ['equipment'] as const,
  lists: () => [...equipmentKeys.all, 'list'] as const,
  single: (id: string) => [...equipmentKeys.all, 'single', id] as const,
}

export const fetchAllEquipment = (systemPref: string) => {
  return queryOptions({
    queryKey: equipmentKeys.lists(),
    queryFn: async () => {
      let allData: { equipment: EquipmentListItem[]; metaData: EquipmentMeta } = {
        equipment: [],
        metaData: {} as EquipmentMeta,
      }
      let nextToken: string | null = null

      const { domainClient, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListMasterEquipmentArgs | QueryListEquipmentArgs

      const isMaster = (data: unknown): data is { listMasterEquipment: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterEquipment' in data
      }

      const operation = master ? listMasterEquipment : listEquipment

      type QueryResponse = { listMasterEquipment: EquipmentConnection } | { listEquipment: EquipmentConnection }

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

          const result = isMaster(data) ? data.listMasterEquipment : data.listEquipment

          allData = { equipment: [...allData.equipment, ...result.items], metaData: result.metaData }
          nextToken = result.nextToken || null
        } while (nextToken)

        if (allData.equipment.length) {
          allData.equipment.sort((a, b) => {
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

export const fetchSingleEquipment = (id: string) => {
  return queryOptions({
    queryKey: equipmentKeys.single(id),
    queryFn: async () => {
      const { domainClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterEquipment: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterEquipment' in data
      }

      const operation = master ? getMasterEquipment : getEquipment

      try {
        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterEquipment
        } else {
          return data.getEquipment
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const useListEquipment = () => {
  const [systemPref] = useSystemPref()
  return useSuspenseQuery(fetchAllEquipment(systemPref))
}

export const useGetEquipment = (id: string) => {
  return useSuspenseQuery(fetchSingleEquipment(id))
}

export const useAddEquipment = () => {
  const queryClient = useQueryClient()

  return useMutation<Equipment, Error, EquipmentInput, unknown>({
    mutationFn: async (equipment: EquipmentInput) => {
      const { domainClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { createMasterEquipment: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterEquipment' in data
      }

      const operation = master ? createMasterEquipment : createEquipment

      try {
        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            input: equipment,
          },
        })

        if (isMaster(data)) {
          return data.createMasterEquipment
        } else {
          return data.createEquipment
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (equipment: Equipment) => {
      queryClient.setQueryData(equipmentKeys.all, (previous: Equipment[]) => {
        if (!previous) return [equipment]
        return [...previous, equipment]
      })
    },
  })
}

export const useUpdateEquipment = () => {
  const queryClient = useQueryClient()

  return useMutation<Equipment, Error, EquipmentInput, unknown>({
    mutationFn: async (equipment: EquipmentInput) => {
      const { domainClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterEquipment: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterEquipment' in data
      }

      const operation = master ? updateMasterEquipment : updateEquipment

      try {
        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            input: equipment,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterEquipment
        } else {
          return data.updateEquipment
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (equipment: Equipment) => {
      queryClient.setQueryData(equipmentKeys.all, (previous: Equipment[]) =>
        previous.map((equipmentKey) => (equipmentKey.id === equipment.id ? equipment : equipmentKey))
      )
    },
  })
}

export const useDeleteEquipment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { domainClient, master } = await getClient()

      const operation = master ? deleteMasterEquipment : deleteEquipment

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterEquipment: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterEquipment' in data
      }

      try {
        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterEquipment
        } else {
          return data.deleteEquipment
        }
      } catch (err) {
        console.log(err)
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(equipmentKeys.all, (previous: Equipment[]) => {
        const equipment = previous.find((equipmentKey) => equipmentKey.id === id)
        if (equipment) {
          return previous.filter((equipmentKey) => equipmentKey.id !== equipment.id)
        }
        return previous
      })
    },
  })
}
