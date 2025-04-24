import { queryOptions } from '@tanstack/react-query'
import { generateClient, GraphQLQuery } from 'aws-amplify/data'
import { listSystems, getSystem, listMasterSystems, getMasterSystem } from '../../amplify/gql/queries'
import { fetchAuthSession } from 'aws-amplify/auth'
import { QueryListMasterSystemsArgs, QueryListSystemsArgs, SystemConnection, type SystemListItem } from '@/types'

const client = generateClient()

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

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? listMasterSystems : listSystems

      type ListVariables = QueryListMasterSystemsArgs | QueryListSystemsArgs

      const variables: ListVariables = {
        limit: 100,
        nextToken,
      }

      try {
        do {
          const { data } = await client.graphql<GraphQLQuery<SystemConnection>>({
            query: operation,
            variables: variables,
          })

          allData = [...allData, ...(data.items || [])]
          nextToken = data.nextToken
        } while (nextToken)

        if (allData && allData.length > 0) {
          return allData.map((system) => ({
            id: system.id,
            label: system.label,
            value: system.value,
          }))
        }

        return []
      } catch (error) {
        console.error('Error fetching systems:', error)
        throw error
      }
    },
  })
}

export const fetchSystem = (systemPref: string) => {
  return queryOptions({
    queryKey: systemsKeys.single(systemPref),
    queryFn: async () => {
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      if (!systemPref) {
        throw 'System preference not found'
      }

      try {
        // Type guard to check which response we got
        function isMaster(data: any): data is { getMasterSystem: any } {
          return 'getMasterSystem' in data
        }

        const operation = master ? getMasterSystem : getSystem

        const { data } = await client.graphql({
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
        console.error('Error fetching systems:', error)
        throw error
      }
    },
  })
}
