import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { fetchCharacters, fetchCharacter } from '@/apis/charactersApi'
import { createArrayWithMethods } from '@/utils'

const useCharacterData = () => {
  const suspenseQuery = useSuspenseQuery
  const suspenseQueries = useSuspenseQueries
  const { systemPref } = useRouteContext({ from: '__root__' })
  const { data: characters } = suspenseQuery(fetchCharacters(systemPref))
  return {
    characters: createArrayWithMethods(characters, {
      findCharacter: (id: string) => suspenseQuery(fetchCharacter(id)).data,
      findCharacters: (ids: string[]) => {
        return suspenseQueries({
          queries: ids.map((id) => fetchCharacter(id)),
          combine: (results) => results.map((result) => result.data),
        })
      },
    }),
  }
}
export default useCharacterData
