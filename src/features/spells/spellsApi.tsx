import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listMasterSpells, listSpells } from '../../../amplify/gql/queries'
import { createSpell, deleteSpell, updateSpell } from '../../../amplify/gql/mutations'
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
      const {
        data: { createSpell: newSpell },
      } = await client.graphql({
        query: createSpell,
        variables: {
          input: spell,
        },
      })

      return newSpell
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

  return useMutation({
    mutationFn: async (spell: SpellInput) => {
      const {
        data: { updateSpell: updatedSpell },
      } = await client.graphql({
        query: updateSpell,
        variables: {
          input: spell,
        },
      })
      return updatedSpell
    },
    onSuccess: (spell: Spell) => {
      queryClient.setQueryData(spellsKeys.all, (previous: Spell[]) =>
        previous.map((spellKey) => (spellKey.id === spell.id ? spell : spellKey))
      )
    },
  })
}

export const useDeleteSpellMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const {
        data: { deleteSpell: deletedId },
      } = await client.graphql({
        query: deleteSpell,
        variables: {
          id,
        },
      })

      return deletedId
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(spellsKeys.all, (previous: Spell[]) => {
        const spell = previous.find((spellKey) => spellKey.id === id)
        return previous.filter((spellKey) => spellKey.id !== spell.id)
      })
    },
  })
}
