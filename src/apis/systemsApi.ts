import { useSuspenseQuery } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listSystems, getSystem, listMasterSystems, getMasterSystem } from '../../amplify/gql/queries'
import useSystemPref from '../hooks/useSystemPref'
import { use } from 'react'
import { AuthContext } from '../pages/auth/AuthContext'
import { fetchAuthSession } from 'aws-amplify/auth'
import { QueryListMasterSystemsArgs, QueryListSystemsArgs, System } from '../../amplify/gql/types'

const client = generateClient()

const systemsKeys = {
  all: ['systems'] as const,
  lists: () => [...systemsKeys.all, 'list'] as const,
  single: (id: string) => [...systemsKeys.all, 'single', id] as const,
}

export const useListSystemsQuery = () => {
  return useSuspenseQuery({
    queryKey: systemsKeys.lists(),
    queryFn: async () => {
      let nextToken = null
      let allData: System[] = []

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { listMasterSystems: any } {
        return 'listMasterSystems' in data
      }

      const operation = master ? listMasterSystems : listSystems

      type ListVariables = QueryListMasterSystemsArgs | QueryListSystemsArgs

      const variables: ListVariables = {
        limit: 100,
        nextToken,
      }

      try {
        do {
          const { data } = await client.graphql({
            query: operation,
            variables: variables,
          })

          // Use type guard to determine which property to access
          const systems = isMaster(data) ? data.listMasterSystems : data.listSystems
          allData = [...allData, ...systems.items]
          nextToken = systems.nextToken
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

export const useGetSystemQuery = () => {
  const { tokens } = use(AuthContext)
  const groups = tokens?.payload?.['cognito:groups'] as string[]
  const master = groups?.includes('Admins') || false
  const [systemsPref] = useSystemPref()

  return useSuspenseQuery({
    queryKey: systemsKeys.single(systemsPref),
    queryFn: async () => {
      if (!systemsPref) {
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
            id: systemsPref,
          },
        })

        // Use type guard to determine which property to access
        const system = isMaster(data) ? data.getMasterSystem : data.getSystem

        if (!system) throw 'System not found'

        const modCategories = system.modifiers.categories.map((category) => {
          const categoryObject: typeof category & {
            types?: typeof system.modifiers.types & { methods?: typeof system.modifiers.methods }
          } = {
            ...category,
          }

          const typeArray =
            system.modifiers.types.filter((type) =>
              system.modifiers.categoryTypes
                .filter((bridge) => bridge?.categoryId === category?.id)
                .some((bridge) => bridge?.typeId === type?.id)
            ) || []

          if (typeArray.length) {
            const types = typeArray.map((type) => {
              const typeObject: typeof type & { methods?: typeof system.modifiers.methods } = {
                ...type,
              }

              const methods = system.modifiers.methods.filter((method) => {
                return system.modifiers.categoryMethods
                  .filter((bridge) => bridge?.categoryId === category?.id && bridge?.typeId === type?.id)
                  .some((bridge) => bridge?.methodId === method?.id)
              })

              if (methods.length) {
                typeObject.methods = methods
              }

              return typeObject
            })

            if (types.length) {
              categoryObject.types = types
            }
          }

          return categoryObject
        })

        const modSpellCategories = system.modifiers.spellCategories.map((category) => {
          const categoryObject: typeof category & {
            types?: typeof system.modifiers.types & { methods?: typeof system.modifiers.methods }
          } = {
            ...category,
          }

          const typeArray = system.modifiers.types.filter((type) =>
            system.modifiers.categoryTypes
              .filter((bridge) => bridge?.categoryId === category?.id)
              .some((bridge) => bridge?.typeId === type?.id)
          )

          const types = typeArray.map((type) => {
            const typeObject: typeof type & { methods?: typeof system.modifiers.methods } = {
              ...type,
            }

            const methods = system.modifiers.methods.filter((method) => {
              return system.modifiers.categoryMethods
                .filter((bridge) => bridge?.categoryId === category?.id && bridge?.typeId === type?.id)
                .some((bridge) => bridge?.methodId === method?.id)
            })

            if (methods.length) {
              typeObject.methods = methods
            }

            return typeObject
          })

          if (types.length) {
            categoryObject.types = types
          }

          return categoryObject
        })

        const equipCategories = system.equipment.categories.map((category) => {
          const categoryObject: typeof category & {
            properties: typeof system.equipment.properties
          } = {
            ...category,
            properties: [],
          }

          const properties = system.equipment.properties.filter((property) => {
            return system.equipment.categoryProperties
              .filter((bridge) => bridge?.categoryId === category?.id)
              .some((bridge) => bridge?.propertyId === property?.id)
          })

          categoryObject.properties = properties

          return categoryObject
        })

        const updatedSystem = {
          ...system,
          modifiers: {
            ...system.modifiers,
            categories: modCategories,
            spellCategories: modSpellCategories,
          },
          equipment: {
            ...system.equipment,
            categories: equipCategories,
          },
        }

        return updatedSystem
      } catch (error) {
        console.error('Error fetching systems:', error)
        throw error
      }
    },
  })
}
