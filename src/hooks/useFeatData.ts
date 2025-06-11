import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { fetchFeat, fetchFeats } from '@/apis/feats.api'
import { useRouteContext } from '@tanstack/react-router'
import { createArrayWithMethods } from '@/utils'

const useFeatData = () => {
  const suspenseQuery = useSuspenseQuery
  const suspenseQueries = useSuspenseQueries
  const { systemPref } = useRouteContext({ from: '__root__' })
  const { data } = suspenseQuery(fetchFeats(systemPref))
  const { feats, metaData } = data
  return {
    feats: createArrayWithMethods(feats, {
      findFeat: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeat(id)).data
      },
      findFeats: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchFeat(id)),
          combine: (results) => results.map((result) => result.data),
        })
      },
    }),
    metaData,
  }
}
export default useFeatData
