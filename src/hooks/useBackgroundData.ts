import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { fetchBackground, fetchBackgrounds } from '@/apis/backgrounds.api'
import { useRouteContext } from '@tanstack/react-router'
import { createArrayWithMethods } from '@/utils'

const useBackgroundData = () => {
  const suspenseQuery = useSuspenseQuery
  const suspenseQueries = useSuspenseQueries
  const { systemPref } = useRouteContext({ from: '__root__' })
  const { data } = suspenseQuery(fetchBackgrounds(systemPref))
  const { backgrounds, metaData } = data
  return {
    backgrounds: createArrayWithMethods(backgrounds, {
      findBackground: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchBackground(id)).data
      },
      findBackgrounds: (ids?: string[] | null) => {
        if (!ids || !ids.length) return []
        return suspenseQueries({
          queries: ids.map((id) => fetchBackground(id)),
          combine: (results) => results.map((result) => result.data),
        })
      },
    }),
    metaData,
  }
}

export default useBackgroundData
