import { useMutation, useQueryClient, queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { getCharacter, listCharacters } from '~/queries'
import { createCharacter, deleteCharacter, updateCharacter } from '~/mutations'
import type { Character, QueryListCharactersArgs, CharacterInput } from '~/types'
import { userDomainClient } from './utils'
import { useSystemPref } from '~/hooks'

const charactersKeys = {
  all: ['characters'] as const,
  lists: (systemPref: string) => [...charactersKeys.all, 'list', systemPref] as const,
  single: (id: string) => [...charactersKeys.all, 'single', id] as const,
}

export const fetchCharacters = (systemPref: string) => {
  return queryOptions({
    queryKey: charactersKeys.lists(systemPref),
    queryFn: async () => {
      let allData: Character[] = []
      let nextToken: string | null = null

      const variables: QueryListCharactersArgs = {
        limit: 100,
        nextToken,
        systemId: systemPref,
      }

      try {
        do {
          const { data } = await userDomainClient.graphql({
            query: listCharacters,
            variables: variables,
          })

          const items = data.listCharacters
          allData = [...allData, ...items.items]
          nextToken = data.listCharacters.nextToken || null
        } while (nextToken)
        allData.sort((a, b) => {
          if (a && b) {
            return a.label.localeCompare(b.label)
          }
          if (a) {
            return -1
          }
          return 1
        })

        return allData
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const fetchCharacter = (id: string) => {
  return queryOptions({
    queryKey: charactersKeys.single(id),
    queryFn: async () => {
      try {
        const {
          data: { getCharacter: character },
        } = await userDomainClient.graphql({
          query: getCharacter,
          variables: {
            id,
          },
        })

        return character
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const useListCharacters = () => {
  const [systemPref] = useSystemPref()
  const { data } = useSuspenseQuery(fetchCharacters(systemPref))

  return data
}

export const useGetCharacter = (id: string) => {
  const { data } = useSuspenseQuery(fetchCharacter(id))

  return data
}

export const useAddCharacter = () => {
  const queryClient = useQueryClient()

  return useMutation<Character, Error, CharacterInput, unknown>({
    mutationFn: async (character: CharacterInput) => {
      try {
        const { data } = await userDomainClient.graphql({
          query: createCharacter,
          variables: {
            input: character,
          },
        })

        return data.createCharacter
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (character: Character) => {
      queryClient.setQueryData(charactersKeys.all, (previous: Character[]) => {
        if (!previous) return [character]
        return [...previous, character]
      })
    },
  })
}

export const useUpdateCharacter = () => {
  const queryClient = useQueryClient()

  return useMutation<Character, Error, CharacterInput, unknown>({
    mutationFn: async (character: CharacterInput) => {
      try {
        const { data } = await userDomainClient.graphql({
          query: updateCharacter,
          variables: {
            input: character,
          },
        })
        return data.updateCharacter
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (character: Character) => {
      queryClient.setQueryData(charactersKeys.all, (previous: Character[]) =>
        previous.map((characterKey) => (characterKey.id === character.id ? character : characterKey))
      )
    },
  })
}

export const useDeleteCharacter = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await userDomainClient.graphql({
        query: deleteCharacter,
        variables: {
          id,
        },
      })

      return data.deleteCharacter
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(charactersKeys.all, (previous: Character[]) => {
        const character = previous.find((characterKey) => characterKey.id === id)
        if (character) {
          return previous.filter((characterKey) => characterKey.id !== character.id)
        }
        return previous
      })
    },
  })
}
