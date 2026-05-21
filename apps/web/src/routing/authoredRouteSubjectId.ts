import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { Api, AuthoredSubjectKindDto } from '#app/lib/api'
import {
  isLegacyAuthoredRouteId,
  parseAuthoredRouteId
} from './authoredRouteHandles'

interface CachedAuthoredRouteList {
  drafts: Array<{
    publicId: string
    subjectId: string
  }>
  items: Array<{
    id: string
    publicId: string
  }>
}

export async function resolveAuthoredRouteSubjectId({
  client,
  listQueryKey,
  publicId,
  queryClient,
  subjectKind
}: {
  client: Api
  listQueryKey: QueryKey
  publicId: string
  queryClient: QueryClient
  subjectKind: AuthoredSubjectKindDto
}) {
  const routeId = parseAuthoredRouteId(publicId)
  if (isLegacyAuthoredRouteId(routeId)) return routeId

  const normalizedPublicId = routeId.toLowerCase()
  const cachedList = queryClient.getQueryData<CachedAuthoredRouteList>(listQueryKey)
  const cachedSubjectId = cachedList?.items.find((item) => item.publicId.toLowerCase() === normalizedPublicId)?.id
    ?? cachedList?.drafts.find((draft) => draft.publicId.toLowerCase() === normalizedPublicId)?.subjectId
  if (cachedSubjectId) return cachedSubjectId

  const routeIdentity = await client.routeIds.resolve({
    publicId: routeId,
    subjectKind
  })

  return routeIdentity?.subjectId ?? routeId
}
