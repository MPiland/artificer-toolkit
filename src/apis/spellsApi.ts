import { useMutation, queryOptions, useQueryClient } from '@tanstack/react-query'
import { generateClient, type GraphQLResult } from 'aws-amplify/data'
import { listMasterSpells, listSpells, getMasterSpell, getSpell } from '@/queries'
import {
  createMasterSpell,
  createSpell,
  deleteMasterSpell,
  deleteSpell,
  updateMasterSpell,
  updateSpell,
} from '@/mutations'
import type {
  SpellInput,
  Spell,
  QueryListMasterSpellsArgs,
  QueryListSpellsArgs,
  SpellListItem,
  SpellMeta,
  SpellConnection,
} from '@/types'
import { fetchAuthSession } from 'aws-amplify/auth'
import { removeTypename } from '@/components/Form'

const client = generateClient()

const spellsKeys = {
  all: ['spells'] as const,
  lists: () => [...spellsKeys.all, 'list'] as const,
  single: (id: string) => [...spellsKeys.all, 'single', id] as const,
}

export const fetchSpells = (systemPref: string) => {
  return queryOptions({
    queryKey: spellsKeys.lists(),
    queryFn: async () => {
      let allData: { spells: SpellListItem[]; metaData: SpellMeta } = {
        spells: [],
        metaData: {} as SpellMeta,
      }
      let nextToken: string | null = null

      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Create a union type for the variables
      type ListVariables = QueryListMasterSpellsArgs | QueryListSpellsArgs

      const isMaster = (data: any): data is { listMasterSpells: any } => {
        return 'listMasterSpells' in data
      }

      const operation = master ? listMasterSpells : listSpells

      type QueryResponse = { listMasterSpells: SpellConnection } | { listSpells: SpellConnection }

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

          const result = isMaster(data) ? data.listMasterSpells : data.listSpells

          allData = { spells: [...allData.spells, ...result.items], metaData: result.metaData }
          nextToken = result.nextToken || null
        } while (nextToken)

        if (allData.spells.length) {
          allData.spells = allData.spells.sort((a, b) => {
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

export const fetchSpell = (id: string) => {
  return queryOptions({
    queryKey: spellsKeys.single(id),
    queryFn: async () => {
      const { tokens } = await fetchAuthSession()
      const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      // Type guard to check which response we got
      function isMaster(data: any): data is { getMasterSpell: any } {
        return 'getMasterSpell' in data
      }

      const operation = master ? getMasterSpell : getSpell

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterSpell
        } else {
          return data.getSpell
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
  })
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
