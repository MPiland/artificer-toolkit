import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

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
    queryFn: async () => await api.content.features.list()
  })
}

export function useGetFeatureList() {
  return useSuspenseQuery(getFeatureList())
}

export function getFeature(id: string) {
  return queryOptions({
    queryKey: featuresKeys.single(id),
    queryFn: async () => await api.content.features.get(id)
  })
}

export function useGetFeature(id: string) {
  return useSuspenseQuery(getFeature(id))
}
