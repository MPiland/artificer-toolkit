import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listBackgrounds } from '../../../amplify/gql/queries'
import { createBackground, deleteBackground, updateBackground } from '../../../amplify/gql/mutations'
import { BackgroundInput, Background } from '../../../amplify/gql/types'
import useSystemPref from '../../hooks/useSystemPref'

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
      try {
        const {
          data: {
            listBackgrounds: { items },
          },
        } = await client.graphql({
          query: listBackgrounds,
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

export const useAddNewBackgroundMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (background: BackgroundInput) => {
      const {
        data: { createBackground: newBackground },
      } = await client.graphql({
        query: createBackground,
        variables: {
          input: background,
        },
      })

      return newBackground
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

  return useMutation({
    mutationFn: async (background: BackgroundInput) => {
      const {
        data: { updateBackground: updatedBackground },
      } = await client.graphql({
        query: updateBackground,
        variables: {
          input: background,
        },
      })
      return updatedBackground
    },
    onSuccess: (background: Background) => {
      queryClient.setQueryData(backgroundsKeys.all, (previous: Background[]) =>
        previous.map((backgroundKey) => (backgroundKey.id === background.id ? background : backgroundKey))
      )
    },
  })
}

export const useDeleteBackgroundMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const {
        data: { deleteBackground: deletedId },
      } = await client.graphql({
        query: deleteBackground,
        variables: {
          id,
        },
      })

      return deletedId
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(backgroundsKeys.all, (previous: Background[]) => {
        const background = previous.find((backgroundKey) => backgroundKey.id === id)
        return previous.filter((backgroundKey) => backgroundKey.id !== background.id)
      })
    },
  })
}
