import { useQueryClient } from '@tanstack/react-query'
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
import {
  getCharacterDraft,
  useGetCharacterList,
  getCharacterSheetSlice
} from '#app/data/characters/queries'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import { useCharacterDeleteAction } from '../../useCharacterDeleteAction'

export function CharacterListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading } = useGetCharacterList()
  const response = data ?? { items: [], meta: {} }
  const deleteAction = useCharacterDeleteAction()

  return (
    <>
      <AuthoredListPage
        title='Characters'
        summary={isLoading ? 'Loading characters…' : summarizeCharacterList(response)}
        createLabel='Create Character'
        items={mapCharacterListToActiveAuthoredItems(response)}
        draftItems={mapCharacterListToDraftAuthoredItems(response)}
        loading={isLoading}
        draftLoading={isLoading}
        filters={buildCharacterListFilters(response)}
        attributeColumns={characterListAttributeColumns}
        sortOptions={characterListSortOptions}
        cardOnly
        onCreate={() => navigate({ to: '/characters/new' })}
        onView={(item) =>
          navigate({
            params: buildCharacterRouteParams(item.publicId, item.name),
            to: '/characters/$characterPublicId/$characterSlug'
          })
        }
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(getCharacterSheetSlice(item.publicId, 'COMMON'))
          void queryClient.prefetchQuery(getCharacterDraft(item.publicId))
        }}
        onEdit={(item) =>
          navigate({
            params: buildCharacterRouteParams(item.publicId, item.name),
            to: '/characters/$characterPublicId/$characterSlug/edit'
          })
        }
        onDelete={(item) => deleteAction.requestDelete({ id: item.id, label: item.name })}
      />
      {deleteAction.confirmation}
    </>
  )
}
