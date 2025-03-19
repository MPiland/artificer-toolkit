import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listMasterSpells, listSpells } from '../../../amplify/gql/queries'
import {
  createMasterSpell,
  createSpell,
  deleteMasterSpell,
  deleteSpell,
  updateMasterSpell,
  updateSpell,
} from '../../../amplify/gql/mutations'
import { SpellInput, Spell } from '../../../amplify/gql/types'
import useSystemPref from '../../hooks/useSystemPref'
import { fetchAuthSession } from 'aws-amplify/auth'

const client = generateClient()

const spellsKeys = {
  all: ['spells'] as const,
  lists: () => [...spellsKeys.all, 'list'] as const,
  single: (id: string) => [...spellsKeys.all, 'single', id] as const,
}

export const useListSpellsQuery = () => {
  const [systemPref] = useSystemPref()

  const query = useSuspenseQuery({
    queryKey: spellsKeys.lists(),
    queryFn: async () => {
      let allData: Spell[] = []
      let nextToken: string | null = null

      try {
        const { tokens } = await fetchAuthSession()
        const groups = tokens.accessToken?.payload?.['cognito:groups'] as string[]
        const master = groups?.includes('Admins') || false

        // Type guard to check which response we got
        function isMaster(data: any): data is { listMasterSpells: any } {
          return 'listMasterSpells' in data
        }

        const operation = master ? listMasterSpells : listSpells

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

          const items = isMaster(data) ? data.listMasterSpells : data.listSpells
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

export const useAddNewSpellMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (spell: SpellInput) => {
      try {
        const { tokens } = await fetchAuthSession()
        const groups = tokens.accessToken?.payload?.['cognito:groups'] as string[]
        const master = groups?.includes('Admins') || false

        const operation = master ? createMasterSpell : createSpell

        // Type guard to check which response we got
        function isMaster(data: any): data is { createMasterSpell: any } {
          return 'createMasterSpell' in data
        }

        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: spell,
          },
        })

        const newSpell = isMaster(data) ? data.createMasterSpell : data.createSpell

        return newSpell
      } catch (err) {
        console.error(err)
      }
    },
    onSuccess: (spell: Spell) => {
      queryClient.setQueryData(spellsKeys.all, (previous: Spell[]) => {
        if (!previous) return [spell]
        return [...previous, spell]
      })
    },
  })
}

export const useUpdateSpellMutation = () => {
  const queryClient = useQueryClient()

  // Helper function to recursively remove __typename fields from a Spell object
  function removeTypename(spell: Spell): SpellInput {
    // Create a deep copy first
    const deepCopy = JSON.parse(JSON.stringify(spell))

    // Function to recursively remove __typename
    function removeTypenameRecursive(obj: any) {
      if (!obj || typeof obj !== 'object') return

      // Delete __typename if it exists
      if ('__typename' in obj) {
        delete obj.__typename
      }

      // Process arrays
      if (Array.isArray(obj)) {
        obj.forEach((item) => {
          if (item && typeof item === 'object') {
            removeTypenameRecursive(item)
          }
        })
      } else {
        // Process object properties
        Object.values(obj).forEach((value) => {
          if (value && typeof value === 'object') {
            removeTypenameRecursive(value)
          }
        })
      }
    }

    // Remove __typename fields from the copy
    removeTypenameRecursive(deepCopy)

    // Return the cleaned object
    return deepCopy as SpellInput
  }

  return useMutation({
    mutationFn: async (spell: Spell) => {
      try {
        // Remove __typename fields from the spell object
        const cleanSpell: SpellInput = removeTypename(spell)
        const { tokens } = await fetchAuthSession()
        const groups = tokens.accessToken?.payload?.['cognito:groups'] as string[]
        const master = groups?.includes('Admins') || false

        const operation = master ? updateMasterSpell : updateSpell

        // Type guard to check which response we got
        function isMaster(data: any): data is { updateMasterSpell: any } {
          return 'updateMasterSpell' in data
        }

        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanSpell,
          },
        })

        const updatedSpell = isMaster(data) ? data.updateMasterSpell : data.updateSpell

        return updatedSpell
      } catch (err) {
        console.error(err)
      }
    },
    onSuccess: (spell: Spell) => {
      queryClient.setQueryData(spellsKeys.all, (previous: Spell[]) =>
        previous?.map((spellKey) => (spellKey.id === spell.id ? spell : spellKey))
      )
    },
  })
}

export const useDeleteSpellMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const { tokens } = await fetchAuthSession()
        const groups = tokens.accessToken?.payload?.['cognito:groups'] as string[]
        const master = groups?.includes('Admins') || false

        const operation = master ? deleteMasterSpell : deleteSpell

        // Type guard to check which response we got
        function isMaster(data: any): data is { deleteMasterSpell: any } {
          return 'deleteMasterSpell' in data
        }
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        const deletedId = isMaster(data) ? data.deleteMasterSpell : data.deleteSpell

        return deletedId
      } catch (err) {
        console.error(err)
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(spellsKeys.all, (previous: Spell[]) => {
        const spell = previous.find((spellKey) => spellKey.id === id)
        return previous.filter((spellKey) => spellKey.id !== spell.id)
      })
    },
  })
}
