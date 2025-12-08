import { useMutation, queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { type GraphQLResult } from 'aws-amplify/data'
import { listMasterSpells, listSpells, getMasterSpell, getSpell } from '~queries'
import {
  createMasterSpell,
  createSpell,
  deleteMasterSpell,
  deleteSpell,
  updateMasterSpell,
  updateSpell,
} from '~mutations'
import type {
  SpellInput,
  Spell,
  QueryListMasterSpellsArgs,
  QueryListSpellsArgs,
  SpellListItem,
  SpellMeta,
  SpellConnection,
} from '~types'
import { getClient } from './utils'
import { useSystemPref } from '~hooks'

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

      const { domainClient, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListMasterSpellsArgs | QueryListSpellsArgs

      const isMaster = (data: unknown): data is { listMasterSpells: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterSpells' in data
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
          const { data } = (await domainClient.graphql({
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
              return a.label.localeCompare(b.label)
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
      const { domainClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterSpell: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterSpell' in data
      }

      const operation = master ? getMasterSpell : getSpell

      try {
        const { data } = await domainClient.graphql({
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
        console.log({ err })
        throw err
      }
    },
  })
}

export const useListSpells = () => {
  const [systemPref] = useSystemPref()
  return useSuspenseQuery(fetchSpells(systemPref))
}

export const useGetSpell = (id: string) => {
  return useSuspenseQuery(fetchSpell(id))
}

export const useAddSpell = () => {
  const queryClient = useQueryClient()

  return useMutation<Spell, Error, SpellInput, unknown>({
    mutationFn: async (spell: SpellInput) => {
      const { domainClient, master } = await getClient()

      const operation = master ? createMasterSpell : createSpell

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { createMasterSpell: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterSpell' in data
      }

      try {
        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            input: spell,
          },
        })

        if (isMaster(data)) {
          return data.createMasterSpell
        } else {
          return data.createSpell
        }
      } catch (err) {
        console.log({ err })
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

export const useUpdateSpell = () => {
  const queryClient = useQueryClient()

  return useMutation<Spell, Error, SpellInput, unknown>({
    mutationFn: async (spell: SpellInput) => {
      const { domainClient, master } = await getClient()

      const operation = master ? updateMasterSpell : updateSpell

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterSpell: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterSpell' in data
      }

      try {
        const { data } = await domainClient.graphql({
          query: operation,
          variables: {
            input: spell,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterSpell
        } else {
          return data.updateSpell
        }
      } catch (err) {
        console.log({ err })
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

export const useDeleteSpell = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { domainClient, master } = await getClient()

      const operation = master ? deleteMasterSpell : deleteSpell

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterSpell: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterSpell' in data
      }

      try {
        const { data } = await domainClient.graphql({
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
        console.log({ err })
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
