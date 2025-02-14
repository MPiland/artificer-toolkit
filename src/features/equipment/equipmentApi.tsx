import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listEquipment } from '../../../amplify/gql/queries'
import { createEquipment, deleteEquipment, updateEquipment } from '../../../amplify/gql/mutations'
import { EquipmentInput, Equipment } from '../../../amplify/gql/types'
import useSystemPref from '../../hooks/useSystemPref'

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
      try {
        const {
          data: {
            listEquipment: { items },
          },
        } = await client.graphql({
          query: listEquipment,
          variables: {
            systemId: systemPref,
          },
        })

        return items
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
