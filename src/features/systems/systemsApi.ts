import { useQuery } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listSystems, getSystem } from '../../../amplify/graphql/queries'
import useSystemPref from '../../hooks/useSystemPref'
import { use } from 'react'
import AuthContext from '../auth/AuthContext'

const client = generateClient()

const systemsKeys = {
  all: ['systems'] as const,
  lists: () => [...systemsKeys.all, 'list'] as const,
  single: (id: string) => [...systemsKeys.all, 'single', id] as const,
}

export const useListSystemsQuery = () => {
  const { user } = use(AuthContext)

  return useQuery({
    queryKey: systemsKeys.lists(),
    queryFn: async () => {
      try {
        const {
          data: {
            listSystems: { items: systems },
          },
        } = await client.graphql({
          query: listSystems,
        })

        if (systems.length > 0) {
          systems.map((system) => {
            return {
              id: system.id,
              label: system.label,
            }
          })

          return systems
        }

        return null
      } catch (error) {
        console.error('Error fetching systems:', error)
        throw error
      }
    },
    enabled: Boolean(user),
  })
}

export const useGetSystemQuery = () => {
  const [systemsPref] = useSystemPref()
  return useQuery({
    queryKey: systemsKeys.single(systemsPref),
    queryFn: async () => {
      if (!systemsPref) {
        return null
      }

      try {
        const {
          data: { getSystem: system },
        } = await client.graphql({
          query: getSystem,
          variables: {
            id: systemsPref,
          },
        })

        if (system) {
          const modCategories = system.modifiers.categories.map((category) => {
            const categoryObject: typeof category & {
              types?: (typeof system.modifiers.types & { methods?: (typeof system.modifiers.methods)[] })[number][]
            } = {
              ...category,
            }

            const typeArray = system.modifiers.types.filter((type) =>
              system.modifiers.categoryTypes
                .filter((bridge) => bridge.categoryId === category.id)
                .some((bridge) => bridge.typeId === type.id)
            )

            const types = typeArray.map((type) => {
              const typeObject: typeof type & { methods?: (typeof system.modifiers.methods)[number][] } = { ...type }

              const methods = system.modifiers.methods.filter((method) => {
                return system.modifiers.categoryMethods
                  .filter((bridge) => bridge.categoryId === category.id && bridge.typeId === type.id)
                  .some((bridge) => bridge.methodId === method.id)
              })

              if (methods.length > 0) {
                typeObject.methods = methods
              }

              return typeObject
            })

            if (types.length > 0) {
              categoryObject.types = types
            }

            return categoryObject
          })

          const modSpellCategories = system.modifiers.spellCategories.map((category) => {
            const categoryObject: typeof category & {
              types?: (typeof system.modifiers.types & { methods?: (typeof system.modifiers.methods)[] })[number][]
            } = {
              ...category,
            }

            const typeArray = system.modifiers.types.filter((type) =>
              system.modifiers.categoryTypes
                .filter((bridge) => bridge.categoryId === category.id)
                .some((bridge) => bridge.typeId === type.id)
            )

            const types = typeArray.map((type) => {
              const typeObject: typeof type & { methods?: (typeof system.modifiers.methods)[number][] } = { ...type }

              const methods = system.modifiers.methods.filter((method) => {
                return system.modifiers.categoryMethods
                  .filter((bridge) => bridge.categoryId === category.id && bridge.typeId === type.id)
                  .some((bridge) => bridge.methodId === method.id)
              })

              if (methods.length > 0) {
                typeObject.methods = methods
              }

              return typeObject
            })

            if (types.length > 0) {
              categoryObject.types = types
            }

            return categoryObject
          })

          const equipCategories = system.equipment.categories.map((category) => {
            const categoryObject: typeof category & {
              properties?: (typeof system.equipment.properties)[number][]
            } = {
              ...category,
            }

            const properties = system.equipment.properties.filter((property) => {
              return system.equipment.categoryProperties
                .filter((bridge) => bridge.categoryId === category.id)
                .some((bridge) => bridge.propertyId === property.id)
            })

            if (properties.length > 0) {
              categoryObject.properties = properties
            }

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
        }

        return null
      } catch (error) {
        console.error('Error fetching systems:', error)
        throw error
      }
    },
    enabled: Boolean(systemsPref),
  })
}
