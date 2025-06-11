import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { fetchFeature, fetchFeatures } from '@/apis/features.api'
import { useRouteContext } from '@tanstack/react-router'
import { createArrayWithMethods } from '@/utils'
import { fetchAncestryFeatures, fetchAncestryFeature } from '@/apis/ancestryFeatures.api'
import { fetchFeatureOption, fetchFeatureOptions } from '@/apis/featureOptions.api'

const useFeatureData = () => {
  const suspenseQuery = useSuspenseQuery
  const suspenseQueries = useSuspenseQueries
  const { systemPref } = useRouteContext({ from: '__root__' })
  const {
    data: { features },
  } = suspenseQuery(fetchFeatures(systemPref))
  const {
    data: { ancestryFeatures },
  } = suspenseQuery(fetchAncestryFeatures(systemPref))
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
          combine: (results) => results.map((result) => result.data),
        })
      },
    }),
    ancestryFeatures: createArrayWithMethods(ancestryFeatures, {
      findAncestryFeature: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchAncestryFeature(id)).data
      },
      findAncestryFeatures: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchAncestryFeature(id)),
          combine: (results) => results.map((result) => result.data),
        })
      },
    }),
    featureOptions: createArrayWithMethods(featureOptions, {
      findOption: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeatureOption(id)).data
      },
      findOptions: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchFeatureOption(id)),
          combine: (results) => results.map((result) => result.data),
        })
      },
    }),
  }
}
export default useFeatureData
