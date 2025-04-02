import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listMasterSpells, listSpells } from '../../amplify/gql/queries'
import {
  createMasterSpell,
  createSpell,
  deleteMasterSpell,
  deleteSpell,
  updateMasterSpell,
  updateSpell,
} from '../../amplify/gql/mutations'
import { SpellInput, Spell, QueryListMasterSpellsArgs, QueryListSpellsArgs } from '../../amplify/gql/types'
import useSystemPref from '../hooks/useSystemPref'
import { fetchAuthSession } from 'aws-amplify/auth'
import { removeTypename } from '../utils/form'

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

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { listMasterSpells: any } {
        return 'listMasterSpells' in data
      }

      const operation = master ? listMasterSpells : listSpells // Create a union type for the variables

      type ListVariables = QueryListMasterSpellsArgs | QueryListSpellsArgs

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

          const items = isMaster(data) ? data.listMasterSpells : data.listSpells

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

export const useAddNewSpellMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Spell, Error, Spell, unknown>({
    mutationFn: async (spell: Spell) => {
      const cleanSpell = removeTypename(spell) as SpellInput

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? createMasterSpell : createSpell

      // Type guard to check which response we got
      function isMaster(data: any): data is { createMasterSpell: any } {
        return 'createMasterSpell' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanSpell,
          },
        })

        if (isMaster(data)) {
          return data.createMasterSpell
        } else {
          return data.createSpell
        }
      } catch (err) {
        console.error({ err })
        throw err
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

  return useMutation<Spell, Error, Spell, unknown>({
    mutationFn: async (spell: Spell) => {
      // Remove __typename fields from the spell object
      const cleanSpell: SpellInput = removeTypename(spell) as SpellInput

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? updateMasterSpell : updateSpell

      // Type guard to check which response we got
      function isMaster(data: any): data is { updateMasterSpell: any } {
        return 'updateMasterSpell' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: cleanSpell,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterSpell
        } else {
          return data.updateSpell
        }
      } catch (err) {
        console.error({ err })
        throw err
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
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const operation = master ? deleteMasterSpell : deleteSpell

      // Type guard to check which response we got
      function isMaster(data: any): data is { deleteMasterSpell: any } {
        return 'deleteMasterSpell' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterSpell
        } else {
          return data.deleteSpell
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(spellsKeys.all, (previous: Spell[]) => {
        const spell = previous.find((spellKey) => spellKey.id === id)
        if (spell) {
          return previous.filter((spellKey) => spellKey.id !== spell.id)
        }
        return previous
      })
    },
  })
}
