import { useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { generateClient, type GraphQLResult } from 'aws-amplify/data'
import { getEquipment, getMasterEquipment, listEquipment, listMasterEquipment } from '../../amplify/gql/queries'
import {
  createEquipment,
  createMasterEquipment,
  deleteEquipment,
  deleteMasterEquipment,
  updateEquipment,
  updateMasterEquipment,
} from '../../amplify/gql/mutations'
import type {
  Equipment,
  QueryListMasterEquipmentArgs,
  QueryListEquipmentArgs,
  EquipmentInput,
  EquipmentConnection,
  EquipmentListItem,
  EquipmentMeta,
} from '@/types'
import { fetchAuthSession } from 'aws-amplify/auth'
import { removeTypename } from '@/components/Form'

const client = generateClient()

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

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Create a union type for the variables
      type ListVariables = QueryListMasterEquipmentArgs | QueryListEquipmentArgs

      const isMaster = (data: any): data is { listMasterEquipment: any } => {
        return 'listMasterEquipment' in data
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
          const { data } = (await client.graphql({
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

export const fetchSingleEquipment = (id: string) => {
  return queryOptions({
    queryKey: equipmentKeys.single(id),
    queryFn: async () => {
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { getMasterEquipment: any } {
        return 'getMasterEquipment' in data
      }

      const operation = master ? getMasterEquipment : getEquipment

      try {
        const { data } = await client.graphql({
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
        console.error({ err })
        throw err
      }
    },
  })
}

export const useAddNewEquipmentMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Equipment, Error, Equipment, unknown>({
    mutationFn: async (equipment: Equipment) => {
      const cleanEquipment = removeTypename(equipment) as EquipmentInput

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { createMasterEquipment: any } {
        return 'createMasterEquipment' in data
      }

      const operation = master ? createMasterEquipment : createEquipment

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanEquipment,
          },
        })

        if (isMaster(data)) {
          return data.createMasterEquipment
        } else {
          return data.createEquipment
        }
      } catch (err) {
        console.error({ err })
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

export const useUpdateEquipmentMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Equipment, Error, Equipment, unknown>({
    mutationFn: async (equipment: Equipment) => {
      const cleanEquipment = removeTypename(equipment) as EquipmentInput

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { updateMasterEquipment: any } {
        return 'updateMasterEquipment' in data
      }

      const operation = master ? updateMasterEquipment : updateEquipment

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanEquipment,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterEquipment
        } else {
          return data.updateEquipment
        }
      } catch (err) {
        console.error({ err })
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

export const useDeleteEquipmentMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? deleteMasterEquipment : deleteEquipment

      // Type guard to check which response we got
      function isMaster(data: any): data is { deleteMasterEquipment: any } {
        return 'deleteMasterEquipment' in data
      }

      try {
        const { data } = await client.graphql({
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
        console.error(err)
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
