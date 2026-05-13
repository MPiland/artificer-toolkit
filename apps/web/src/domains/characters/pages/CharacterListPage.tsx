import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildCharacterListFilters,
  characterListAttributeColumns,
  characterListSortOptions,
  mapCharacterListToActiveAuthoredItems,
  mapCharacterListToDraftAuthoredItems,
  summarizeCharacterList
} from '#app/data/characters/characterListMapper'
import { getCharacterDraft, getCharacterList, getCharacterSheet } from '#app/data/characters/queries'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'

export function CharacterListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(getCharacterList())

  return (
    <AuthoredListPage
      title='Characters'
      summary={summarizeCharacterList(data)}
      createLabel='Create Character'
      items={mapCharacterListToActiveAuthoredItems(data)}
      draftItems={mapCharacterListToDraftAuthoredItems(data)}
      filters={buildCharacterListFilters(data)}
      attributeColumns={characterListAttributeColumns}
      sortOptions={characterListSortOptions}
      onCreate={() => navigate({ to: '/characters/new' })}
      onView={(item) => navigate({
        params: buildCharacterRouteParams(item.publicId, item.name),
        to: '/characters/$characterPublicId/$characterSlug'
      })}
      onViewIntent={(item) => {
        void queryClient.prefetchQuery(getCharacterSheet(item.publicId))
        void queryClient.prefetchQuery(getCharacterDraft(item.publicId))
      }}
      onEdit={(item) => navigate({
        params: buildCharacterRouteParams(item.publicId, item.name),
        to: '/characters/$characterPublicId/$characterSlug/edit'
      })}
    />
  )
}
