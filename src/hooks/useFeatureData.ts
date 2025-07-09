import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { fetchFeature, fetchFeatures } from '@/apis/features.api'
import { useRouteContext } from '@tanstack/react-router'
import { createArrayWithMethods } from '@/utils'
import { fetchAncestryOptions, fetchAncestryOption } from '@/apis/ancestryOptions.api'
import { fetchFeatureOption, fetchFeatureOptions } from '@/apis/featureOptions.api'

const useFeatureData = () => {
  const suspenseQuery = useSuspenseQuery
  const suspenseQueries = useSuspenseQueries
  const { systemPref } = useRouteContext({ from: '__root__' })
  const {
    data: { features },
  } = suspenseQuery(fetchFeatures(systemPref))
  const {
    data: { ancestryOptions },
  } = suspenseQuery(fetchAncestryOptions(systemPref))
  const {
    data: { featureOptions },
  } = suspenseQuery(fetchFeatureOptions(systemPref))
  return {
    features: createArrayWithMethods(features, {
      findFeature: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeature(id)).data
      },
      findFeatures: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchFeature(id)),
          combine: (results) => {
            const resultArray = results.map((result) => result.data || undefined).filter(Boolean)
            return resultArray as NonNullable<(typeof resultArray)[number]>[]
          },
        })
      },
    }),
    ancestryOptions: createArrayWithMethods(ancestryOptions, {
      findAncestryOption: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchAncestryOption(id)).data
      },
      findAncestryOptions: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchAncestryOption(id)),
          combine: (results) => {
            const resultArray = results.map((result) => result.data || undefined).filter(Boolean)
            return resultArray as NonNullable<(typeof resultArray)[number]>[]
          },
        })
      },
    }),
    featureOptions: createArrayWithMethods(featureOptions, {
      findFeatureOption: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeatureOption(id)).data
      },
      findFeatureOptions: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchFeatureOption(id)),
          combine: (results) => {
            const resultArray = results.map((result) => result.data || undefined).filter(Boolean)
            return resultArray as NonNullable<(typeof resultArray)[number]>[]
          },
        })
      },
    }),
  }
}
export default useFeatureData
