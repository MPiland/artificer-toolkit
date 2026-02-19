import { handleRequest, getFeatureListQuery, getFeatureQuery } from '@artificer-toolkit/functions'
import type { Feature, FeatureListItem } from '@artificer-toolkit/shared'

// list
export const getFeatureList = handleRequest<[], FeatureListItem[] | []>(getFeatureListQuery, () => [])

// single
export const getFeature = handleRequest<[string], Feature | null>(getFeatureQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})
