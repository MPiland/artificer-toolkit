import { queryOptions } from '@tanstack/react-query'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export const accountProfileQueryKey = ['account', 'profile'] as const

export function getAccountProfileQuery(userId: string) {
  return queryOptions({
    queryKey: [...accountProfileQueryKey, userId],
    queryFn: () => api.account.profile()
  })
}

export function getAccountEntitlementsQuery(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.account.entitlements(),
    queryFn: () => client.account.entitlements()
  })
}
