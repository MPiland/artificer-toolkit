import type {
  EnsureQueryDataOptions,
  QueryClient,
  QueryKey
} from '@tanstack/react-query'
import { ApiError } from '#app/lib/api'

export async function ensureOptionalActiveContent<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey
>(
  queryClient: QueryClient,
  options: EnsureQueryDataOptions<TQueryFnData, TError, TData, TQueryKey>
): Promise<TData | null> {
  try {
    return await queryClient.ensureQueryData(options)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      queryClient.setQueryData<TData | null>(options.queryKey, null)
      return null
    }

    throw error
  }
}
