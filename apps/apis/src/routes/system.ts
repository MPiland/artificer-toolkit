import { handleRequest, getSystemListQuery, getSystemQuery } from '@artificer-toolkit/functions'
import type { System, SystemListItem } from '@artificer-toolkit/shared'

// list
export const getSystemList = handleRequest<[], SystemListItem[] | []>(getSystemListQuery, () => [])

// single
export const getSystem = handleRequest<[string], System | null>(getSystemQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})
