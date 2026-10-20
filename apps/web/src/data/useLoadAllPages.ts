import { useEffect } from 'react'

interface PagedResult {
  status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'
  loadMore: (numItems: number) => void
}

/**
 * Drains a paginated query to its last page, for lists that must hold every row (pickers,
 * eligibility, totals). Screens call this instead of writing their own drain effect.
 */
export function useLoadAllPages(
  { status, loadMore }: PagedResult,
  pageSize: number,
  enabled = true
) {
  useEffect(() => {
    if (enabled && status === 'CanLoadMore') loadMore(pageSize)
  }, [enabled, status, loadMore, pageSize])
}
