import { useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildCharacterListFilters,
  characterListAttributeColumns,
  characterListSortOptions,
  mapCharacterListToAuthoredItems,
  summarizeCharacterList
} from '#app/data/characters/characterListMapper'
import { getCharacterList } from '#app/data/characters/queries'

export function CharacterListPage() {
  const navigate = useNavigate()
  const { data } = useSuspenseQuery(getCharacterList())

  return (
    <AuthoredListPage
      title='Characters'
      summary={summarizeCharacterList(data)}
      createLabel='Create Character'
      items={mapCharacterListToAuthoredItems(data)}
      filters={buildCharacterListFilters(data)}
      attributeColumns={characterListAttributeColumns}
      sortOptions={characterListSortOptions}
      onCreate={() => navigate({ to: '/characters/new' })}
      onView={(item) => navigate({ to: '/characters/$characterId', params: { characterId: item.id } })}
      onEdit={(item) => navigate({ to: '/characters/$characterId/edit', params: { characterId: item.id } })}
    />
  )
}
