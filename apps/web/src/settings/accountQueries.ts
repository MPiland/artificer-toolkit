import { queryOptions } from '@tanstack/react-query'
import { api } from '#app/lib/api'

export const accountProfileQueryKey = ['account', 'profile'] as const

export function getAccountProfileQuery() {
  return queryOptions({
    queryKey: accountProfileQueryKey,
    queryFn: () => api.account.profile()
  })
}
