import { useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { type GraphQLResult } from 'aws-amplify/data'
import { listMasterRaces, listRaces, getRace, getMasterRace } from '@/queries'
import { createMasterRace, createRace, deleteMasterRace, deleteRace, updateMasterRace, updateRace } from '@/mutations'
import type {
  RaceInput,
  Race,
  QueryListMasterRacesArgs,
  QueryListRacesArgs,
  RaceListItem,
  RaceMeta,
  RaceConnection,
} from '@/types'
import { getClient } from './utils'

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

      const { client, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListMasterRacesArgs | QueryListRacesArgs

      const isMaster = (data: any): data is { listMasterRaces: any } => {
        return 'listMasterRaces' in data
      }

      const operation = master ? listMasterRaces : listRaces

      type QueryResponse = { listMasterRaces: RaceConnection } | { listRaces: RaceConnection }

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

          const result = isMaster(data) ? data.listMasterRaces : data.listRaces

          allData = { races: [...allData.races, ...result.items], metaData: result.metaData }
          nextToken = result.nextToken || null
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
      const { client, master } = await getClient()

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

  return useMutation<Race, Error, RaceInput, unknown>({
    mutationFn: async (race: RaceInput) => {
      const { client, master } = await getClient()

      const operation = master ? createMasterRace : createRace

      // Type guard to check which response we got
      function isMaster(data: any): data is { createMasterRace: any } {
        return 'createMasterRace' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: race,
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

  return useMutation<Race, Error, RaceInput, unknown>({
    mutationFn: async (race: RaceInput) => {
      const { client, master } = await getClient()

      const operation = master ? updateMasterRace : updateRace

      // Type guard to check which response we got
      function isMaster(data: any): data is { updateMasterRace: any } {
        return 'updateMasterRace' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: race,
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
      const { client, master } = await getClient()

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
