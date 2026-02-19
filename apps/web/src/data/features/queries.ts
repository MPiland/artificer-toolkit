import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { getFeatureFn } from '@server/domains'
import { getFeatureListFn } from '@server/domains'

const featuresKeys = {
  all: [
    'features'
  ] as const,
  lists: () => [
    ...featuresKeys.all, 'list'
  ] as const,
  single: (id: string) => [
    ...featuresKeys.all, 'single', id
  ] as const
}

export function getFeatureList() {
  return queryOptions({
    queryKey: featuresKeys.lists(),
    queryFn: async () => await getFeatureListFn()
  })
}

export function useGetFeatureList() {
  return useSuspenseQuery(getFeatureList())
}

export function getFeature(id: string) {
  return queryOptions({
    queryKey: featuresKeys.single(id),
    queryFn: async () => await getFeatureFn({
      data: id
    })
  })
}

export function useGetFeature(id: string) {
  return useSuspenseQuery(getFeature(id))
}
