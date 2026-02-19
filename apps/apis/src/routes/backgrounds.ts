import { handleRequest, getBackgroundListQuery, getBackgroundQuery } from '@artificer-toolkit/functions'
import type { Background, BackgroundListItem } from '@artificer-toolkit/shared'

// list
export const getBackgroundList = handleRequest<[], BackgroundListItem[] | []>(getBackgroundListQuery, () => [])

// single
export const getBackground = handleRequest<[string], Background | null>(getBackgroundQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})
