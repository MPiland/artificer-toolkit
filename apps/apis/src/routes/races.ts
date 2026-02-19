import { handleRequest, getRaceListQuery, getRaceQuery } from '@artificer-toolkit/functions'
import type { Race, RaceListItem } from '@artificer-toolkit/shared'

// list
export const getRaceList = handleRequest<[], RaceListItem[] | []>(getRaceListQuery, () => [])

// single
export const getRace = handleRequest<[string], Race | null>(getRaceQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})
