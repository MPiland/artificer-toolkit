import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listRaces } from '../../../amplify/gql/queries'
import { createRace, deleteRace, updateRace } from '../../../amplify/gql/mutations'
import { RaceInput, Race } from '../../../amplify/gql/types'
import useSystemPref from '../../hooks/useSystemPref'

const client = generateClient()

const racesKeys = {
  all: ['races'] as const,
  lists: () => [...racesKeys.all, 'list'] as const,
  single: (id: string) => [...racesKeys.all, 'single', id] as const,
}

export const useListRacesQuery = () => {
  const [systemPref] = useSystemPref()

  const query = useSuspenseQuery({
    queryKey: racesKeys.lists(),
    queryFn: async () => {
      try {
        const {
          data: {
            listRaces: { items },
          },
        } = await client.graphql({
          query: listRaces,
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

export const useAddNewRaceMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (race: RaceInput) => {
      const {
        data: { createRace: newRace },
      } = await client.graphql({
        query: createRace,
        variables: {
          input: race,
        },
      })

      return newRace
    },
    onSuccess: (race: Race) => {
      queryClient.setQueryData(racesKeys.all, (previous: Race[]) => {
        if (!previous) return [race]
        return [...previous, race]
      })
    },
  })
}

export const useUpdateRaceMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (race: RaceInput) => {
      const {
        data: { updateRace: updatedRace },
      } = await client.graphql({
        query: updateRace,
        variables: {
          input: race,
        },
      })
      return updatedRace
    },
    onSuccess: (race: Race) => {
      queryClient.setQueryData(racesKeys.all, (previous: Race[]) =>
        previous.map((raceKey) => (raceKey.id === race.id ? race : raceKey))
      )
    },
  })
}

export const useDeleteRaceMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const {
        data: { deleteRace: deletedId },
      } = await client.graphql({
        query: deleteRace,
        variables: {
          id,
        },
      })

      return deletedId
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(racesKeys.all, (previous: Race[]) => {
        const race = previous.find((raceKey) => raceKey.id === id)
        return previous.filter((raceKey) => raceKey.id !== race.id)
      })
    },
  })
}
