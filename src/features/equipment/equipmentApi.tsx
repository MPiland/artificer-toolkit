import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listEquipment, listMasterEquipment } from '../../../amplify/gql/queries'
import { createEquipment, deleteEquipment, updateEquipment } from '../../../amplify/gql/mutations'
import { EquipmentInput, Equipment } from '../../../amplify/gql/types'
import useSystemPref from '../../hooks/useSystemPref'
import { fetchAuthSession } from 'aws-amplify/auth'

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

      try {
        const { tokens } = await fetchAuthSession()
        const groups = tokens.accessToken?.payload?.['cognito:groups'] as string[]
        const master = groups?.includes('Admins') || false

        // Type guard to check which response we got
        function isMaster(data: any): data is { listMasterEquipment: any } {
          return 'listMasterEquipment' in data
        }

        const operation = master ? listMasterEquipment : listEquipment

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

          const items = isMaster(data) ? data.listMasterEquipment : data.listEquipment
          allData = [...allData, ...items.items]
          nextToken = items.nextToken
        } while (nextToken)

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

export const useAddNewEquipmentMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (equipment: EquipmentInput) => {
      const {
        data: { createEquipment: newEquipment },
      } = await client.graphql({
        query: createEquipment,
        variables: {
          input: equipment,
        },
      })

      return newEquipment
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

  return useMutation({
    mutationFn: async (equipment: EquipmentInput) => {
      const {
        data: { updateEquipment: updatedEquipment },
      } = await client.graphql({
        query: updateEquipment,
        variables: {
          input: equipment,
        },
      })
      return updatedEquipment
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
      const {
        data: { deleteEquipment: deletedId },
      } = await client.graphql({
        query: deleteEquipment,
        variables: {
          id,
        },
      })

      return deletedId
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(equipmentKeys.all, (previous: Equipment[]) => {
        const equipment = previous.find((equipmentKey) => equipmentKey.id === id)
        return previous.filter((equipmentKey) => equipmentKey.id !== equipment.id)
      })
    },
  })
}
