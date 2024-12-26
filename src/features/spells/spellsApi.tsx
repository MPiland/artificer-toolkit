import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { listSpells } from '../../../amplify/graphql/queries'
import { createSpell, deleteSpell, updateSpell } from '../../../amplify/graphql/mutations'
import { SpellInput, Spell } from '../../../amplify/API'
import useSystemPref from '../../hooks/useSystemPref'

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
      try {
        const {
          data: {
            listSpells: { items },
          },
        } = await client.graphql({
          query: listSpells,
          variables: {
            systemId: systemPref,
          },
        })

        return items
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
