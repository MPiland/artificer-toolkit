import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listMasterRaces, listRaces } from '../../../amplify/gql/queries'
import { createRace, deleteRace, updateRace } from '../../../amplify/gql/mutations'
import { RaceInput, Race } from '../../../amplify/gql/types'
import useSystemPref from '../../hooks/useSystemPref'
import { fetchAuthSession } from 'aws-amplify/auth'

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
      let allData: Race[] = []
      let nextToken: string | null = null

      try {
        const { tokens } = await fetchAuthSession()
        const groups = tokens.accessToken?.payload?.['cognito:groups'] as string[]
        const master = groups?.includes('Admins') || false

        // Type guard to check which response we got
        function isMaster(data: any): data is { listMasterRaces: any } {
          return 'listMasterRaces' in data
        }

        const operation = master ? listMasterRaces : listRaces

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

          const items = isMaster(data) ? data.listMasterRaces : data.listRaces
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
