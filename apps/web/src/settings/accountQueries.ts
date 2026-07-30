import { queryOptions } from '@tanstack/react-query'
import { api } from '#app/lib/api'

export const accountProfileQueryKey = ['account', 'profile'] as const

export function getAccountProfileQuery(userId: string) {
  return queryOptions({
    queryKey: [...accountProfileQueryKey, userId],
    queryFn: () => api.account.profile()
  })
}
