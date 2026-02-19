import { handleRequest, getClassListQuery, getClassQuery } from '@artificer-toolkit/functions'
import type { Class, ClassListItem } from '@artificer-toolkit/shared'

// list
export const getClassList = handleRequest<[], ClassListItem[] | []>(getClassListQuery, () => [])

// single
export const getClass = handleRequest<[string], Class | null>(getClassQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})
