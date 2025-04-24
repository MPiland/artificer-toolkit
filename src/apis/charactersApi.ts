import { useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import { getCharacter, listCharacters } from '../../amplify/gql/queries'
import { createCharacter, deleteCharacter, updateCharacter } from '../../amplify/gql/mutations'
import type { Character, QueryListCharactersArgs, CharacterInput } from '@/types'
import { removeTypename } from '@/components/Form'

const client = generateClient()

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
          const { data } = await client.graphql({
            query: listCharacters,
            variables: variables,
          })

          const items = data.listCharacters
          allData = [...allData, ...items.items]
          nextToken = data.listCharacters.nextToken || null
        } while (nextToken)

        return allData
      } catch (err) {
        console.error({ err })
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
        } = await client.graphql({
          query: getCharacter,
          variables: {
            id,
          },
        })

        return character
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
  })
}

export const useAddCharacter = () => {
  const queryClient = useQueryClient()

  return useMutation<Character, Error, Character, unknown>({
    mutationFn: async (character: Character) => {
      const cleanCharacter = removeTypename(character) as CharacterInput

      try {
        const { data } = await client.graphql({
          query: createCharacter,
          variables: {
            input: cleanCharacter,
          },
        })

        return data.createCharacter
      } catch (err) {
        console.error({ err })
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

  return useMutation<Character, Error, Character, unknown>({
    mutationFn: async (character: Character) => {
      const cleanCharacter = removeTypename(character) as CharacterInput
      try {
        const { data } = await client.graphql({
          query: updateCharacter,
          variables: {
            input: cleanCharacter,
          },
        })
        return data.updateCharacter
      } catch (err) {
        console.error({ err })
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
      const { data } = await client.graphql({
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
