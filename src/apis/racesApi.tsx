import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listMasterRaces, listRaces } from '../../amplify/gql/queries'
import {
  createMasterRace,
  createRace,
  deleteMasterRace,
  deleteRace,
  updateMasterRace,
  updateRace,
} from '../../amplify/gql/mutations'
import { RaceInput, Race, QueryListMasterRacesArgs, QueryListRacesArgs } from '../../amplify/gql/types'
import useSystemPref from '../hooks/useSystemPref'
import { fetchAuthSession } from 'aws-amplify/auth'
import { removeTypename } from '../utils/form'

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

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { listMasterRaces: any } {
        return 'listMasterRaces' in data
      }

      const operation = master ? listMasterRaces : listRaces

      type ListVariables = QueryListMasterRacesArgs | QueryListRacesArgs

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

          const items = isMaster(data) ? data.listMasterRaces : data.listRaces

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

export const useAddNewRaceMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Race, Error, Race, unknown>({
    mutationFn: async (race: Race) => {
      const cleanRace = removeTypename(race)

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? createMasterRace : createRace

      // Type guard to check which response we got
      function isMaster(data: any): data is { createMasterRace: any } {
        return 'createMasterRace' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanRace,
          },
        })

        if (isMaster(data)) {
          return data.createMasterRace
        } else {
          return data.createRace
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
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

  return useMutation<Race, Error, Race, unknown>({
    mutationFn: async (race: Race) => {
      // Remove __typename fields from the race object
      const cleanRace: RaceInput = removeTypename(race)
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? updateMasterRace : updateRace

      // Type guard to check which response we got
      function isMaster(data: any): data is { updateMasterRace: any } {
        return 'updateMasterRace' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanRace,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterRace
        } else {
          return data.updateRace
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (race: Race) => {
      queryClient.setQueryData(racesKeys.all, (previous: Race[]) =>
        previous?.map((raceKey) => (raceKey.id === race.id ? race : raceKey))
      )
    },
  })
}

export const useDeleteRaceMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? deleteMasterRace : deleteRace

      // Type guard to check which response we got
      function isMaster(data: any): data is { deleteMasterRace: any } {
        return 'deleteMasterRace' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterRace
        } else {
          return data.deleteRace
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(racesKeys.all, (previous: Race[]) => {
        const race = previous.find((raceKey) => raceKey.id === id)
        if (race) {
          return previous.filter((raceKey) => raceKey.id !== race.id)
        }
      })
    },
  })
}
