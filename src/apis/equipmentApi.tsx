import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listEquipment, listMasterEquipment } from '../../amplify/gql/queries'
import {
  createEquipment,
  createMasterEquipment,
  deleteEquipment,
  deleteMasterEquipment,
  updateEquipment,
  updateMasterEquipment,
} from '../../amplify/gql/mutations'
import { Equipment, QueryListMasterEquipmentArgs, QueryListEquipmentArgs, type EquipmentInput } from '../../amplify/gql/types'
import useSystemPref from '../hooks/useSystemPref'
import { fetchAuthSession } from 'aws-amplify/auth'
import { removeTypename } from '../utils/form'

const client = generateClient()

const equipmentKeys = {
  all: ['equipment'] as const,
  lists: () => [...equipmentKeys.all, 'list'] as const,
  single: (id: string) => [...equipmentKeys.all, 'single', id] as const,
}

export const useListEquipmentQuery = () => {
  const [systemPref] = useSystemPref()

  const query = useSuspenseQuery({
    queryKey: equipmentKeys.lists(),
    queryFn: async () => {
      let allData: Equipment[] = []
      let nextToken: string | null = null

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { listMasterEquipment: any } {
        return 'listMasterEquipment' in data
      }

      const operation = master ? listMasterEquipment : listEquipment

      type ListVariables = QueryListMasterEquipmentArgs | QueryListEquipmentArgs

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

          const items = isMaster(data) ? data.listMasterEquipment : data.listEquipment
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
