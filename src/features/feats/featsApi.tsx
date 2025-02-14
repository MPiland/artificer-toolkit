import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listFeats } from '../../../amplify/gql/queries'
import { createFeat, deleteFeat, updateFeat } from '../../../amplify/gql/mutations'
import { FeatInput, Feat } from '../../../amplify/gql/types'
import useSystemPref from '../../hooks/useSystemPref'

const client = generateClient()

const featsKeys = {
  all: ['feats'] as const,
  lists: () => [...featsKeys.all, 'list'] as const,
  single: (id: string) => [...featsKeys.all, 'single', id] as const,
}

export const useListFeatsQuery = () => {
  const [systemPref] = useSystemPref()

  const query = useSuspenseQuery({
    queryKey: featsKeys.lists(),
    queryFn: async () => {
      try {
        const {
          data: {
            listFeats: { items },
          },
        } = await client.graphql({
          query: listFeats,
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

export const useAddNewFeatMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (feat: FeatInput) => {
      const {
        data: { createFeat: newFeat },
      } = await client.graphql({
        query: createFeat,
        variables: {
          input: feat,
        },
      })

      return newFeat
    },
    onSuccess: (feat: Feat) => {
      queryClient.setQueryData(featsKeys.all, (previous: Feat[]) => {
        if (!previous) return [feat]
        return [...previous, feat]
      })
    },
  })
}

export const useUpdateFeatMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (feat: FeatInput) => {
      const {
        data: { updateFeat: updatedFeat },
      } = await client.graphql({
        query: updateFeat,
        variables: {
          input: feat,
        },
      })
      return updatedFeat
    },
    onSuccess: (feat: Feat) => {
      queryClient.setQueryData(featsKeys.all, (previous: Feat[]) =>
        previous.map((featKey) => (featKey.id === feat.id ? feat : featKey))
      )
    },
  })
}

export const useDeleteFeatMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const {
        data: { deleteFeat: deletedId },
      } = await client.graphql({
        query: deleteFeat,
        variables: {
          id,
        },
      })

      return deletedId
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(featsKeys.all, (previous: Feat[]) => {
        const feat = previous.find((featKey) => featKey.id === id)
        return previous.filter((featKey) => featKey.id !== feat.id)
      })
    },
  })
}
