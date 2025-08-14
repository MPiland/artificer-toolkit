import { queryOptions } from '@tanstack/react-query'
import { listSystems, getSystem, listMasterSystems, getMasterSystem } from '~/queries'
import type { QueryListMasterSystemsArgs, QueryListSystemsArgs, SystemListItem } from '~/types'
import { getClient } from './utils'

const systemsKeys = {
  all: ['systems'] as const,
  lists: () => [...systemsKeys.all, 'list'] as const,
  single: (id: string) => [...systemsKeys.all, 'single', id] as const,
}

export const fetchSystems = () => {
  return queryOptions({
    queryKey: systemsKeys.lists(),
    queryFn: async () => {
      let nextToken = null
      let allData: SystemListItem[] = []

      const { domainClient, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListMasterSystemsArgs | QueryListSystemsArgs

      const isMaster = (data: unknown): data is { listMasterSystems: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterSystems' in data
      }

      const operation = master ? listMasterSystems : listSystems

      const variables: ListVariables = {
        limit: 100,
        nextToken,
      }

      try {
        do {
          const { data } = await domainClient.graphql({
            query: operation,
            variables: variables,
          })

          const result = isMaster(data) ? data.listMasterSystems : data.listSystems

          allData = [...allData, ...result.items]
          nextToken = result.nextToken
        } while (nextToken)

        if (allData && allData.length > 0) {
          return allData.map((system) => ({
            id: system.id,
            label: system.label,
          }))
        }
        return []
      } catch (error) {
        console.log('Error fetching systems:', error)
        return []
      }
    },
  })
}

export const fetchSystem = (systemPref: string) => {
  return queryOptions({
    queryKey: systemsKeys.single(systemPref),
    queryFn: async () => {
      const { domainClient, master } = await getClient()

      if (!systemPref) {
        throw 'System preference not found'
      }

      try {
        // Type guard to check which response we got
        function isMaster(data: unknown): data is { getMasterSystem: unknown } {
          return typeof data === 'object' && data !== null && 'getMasterSystem' in data
        }

        const operation = master ? getMasterSystem : getSystem

        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            id: systemPref,
          },
        })

        if (isMaster(data)) {
          return data.getMasterSystem
        } else {
          return data.getSystem
        }
      } catch (error) {
        console.log('Error fetching system:', error)
        return null
      }
    },
  })
}
