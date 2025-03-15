import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import useSystemPref from '../../hooks/useSystemPref'
import { listCharacters } from '../../../amplify/gql/queries'
import { createCharacter, deleteCharacter, updateCharacter } from '../../../amplify/gql/mutations'
import { CharacterInput, Character } from '../../../amplify/gql/types'

const client = generateClient()

const charactersKeys = {
  all: ['characters'] as const,
  lists: () => [...charactersKeys.all, 'list'] as const,
  single: (id: string) => [...charactersKeys.all, 'single', id] as const,
}

export const useListCharactersQuery = () => {
  const [systemPref] = useSystemPref()

  const query = useSuspenseQuery({
    queryKey: charactersKeys.lists(),
    queryFn: async () => {
      let allData: Character[] = []
      let nextToken: string | null = null

      try {
        do {
          const { data } = await client.graphql({
            query: listCharacters,
            variables: {
              limit: 100,
              nextToken,
              systemId: systemPref,
            },
          })

          allData = [...allData, ...data.listCharacters.items]
          nextToken = data.listCharacters.nextToken
        } while (nextToken)

        return allData
      } catch (err) {
        console.log({ err })
      }
    },
  })

  return query
}

export const useAddNewCharacterMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (character: CharacterInput) => {
      const {
        data: { createCharacter: newCharacter },
      } = await client.graphql({
        query: createCharacter,
        variables: {
          input: character,
        },
      })

      return newCharacter
    },
    onSuccess: (character: Character) => {
      queryClient.setQueryData(charactersKeys.all, (previous: Character[]) => {
        if (!previous) return [character]
        return [...previous, character]
      })
    },
  })
}

export const useUpdateCharacterMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (character: CharacterInput) => {
      const {
        data: { updateCharacter: updatedCharacter },
      } = await client.graphql({
        query: updateCharacter,
        variables: {
          input: character,
        },
      })
      return updatedCharacter
    },
    onSuccess: (character: Character) => {
      queryClient.setQueryData(charactersKeys.all, (previous: Character[]) =>
        previous.map((characterKey) => (characterKey.id === character.id ? character : characterKey))
      )
    },
  })
}

export const useDeleteCharacterMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const {
        data: { deleteCharacter: deletedId },
      } = await client.graphql({
        query: deleteCharacter,
        variables: {
          id,
        },
      })

      return deletedId
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(charactersKeys.all, (previous: Character[]) => {
        const character = previous.find((characterKey) => characterKey.id === id)
        return previous.filter((characterKey) => characterKey.id !== character.id)
      })
    },
  })
}
