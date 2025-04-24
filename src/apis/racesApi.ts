import { useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { generateClient, GraphQLQuery } from 'aws-amplify/data'
import { listMasterRaces, listRaces, getRace, getMasterRace } from '../../amplify/gql/queries'
import {
  createMasterRace,
  createRace,
  deleteMasterRace,
  deleteRace,
  updateMasterRace,
  updateRace,
} from '../../amplify/gql/mutations'
import type {
  RaceInput,
  Race,
  QueryListMasterRacesArgs,
  QueryListRacesArgs,
  RaceListItem,
  RaceMeta,
  RaceConnection,
} from '@/types'
import { fetchAuthSession } from 'aws-amplify/auth'
import { removeTypename } from '@/components/Form'

const client = generateClient()

const racesKeys = {
  all: ['races'] as const,
  lists: () => [...racesKeys.all, 'list'] as const,
  single: (id: string) => [...racesKeys.all, 'single', id] as const,
}

export const fetchRaces = (systemPref: string) => {
  return queryOptions({
    queryKey: racesKeys.lists(),
    queryFn: async () => {
      let allData: { races: RaceListItem[]; metaData: RaceMeta } = {
        races: [],
        metaData: {} as RaceMeta,
      }
      let nextToken: string | null = null

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? listMasterRaces : listRaces // Create a union type for the variables

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
          const { data } = await client.graphql<GraphQLQuery<RaceConnection>>({
            query: operation,
            variables: variables,
          })

          allData = { races: [...allData.races, ...data.items], metaData: data.metaData }
          nextToken = data.nextToken || null
        } while (nextToken)

        if (allData.races.length) {
          allData.races.sort((a, b) => {
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
        console.log({ err })
        throw err
      }
    },
  })
}

export const fetchRace = (id: string) => {
  return queryOptions({
    queryKey: racesKeys.single(id),
    queryFn: async () => {
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { getMasterRace: any } {
        return 'getMasterRace' in data
      }

      const operation = master ? getMasterRace : getRace

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterRace
        } else {
          return data.getRace
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
  })
}

export const useAddNewRaceMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Race, Error, Race, unknown>({
    mutationFn: async (race: Race) => {
      const cleanRace = removeTypename(race) as RaceInput

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
      const cleanRace: RaceInput = removeTypename(race) as RaceInput
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
