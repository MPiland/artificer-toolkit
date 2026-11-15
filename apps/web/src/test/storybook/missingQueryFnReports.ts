import type { QueryClient } from '@tanstack/react-query'

const MISSING_QUERY_FN = 'Missing queryFn'

/**
 * Returns the list `queryClient` appends a report to whenever a read fails because it has no query
 * function. TanStack Query only rejects that read; it writes nothing to the console, so a story would
 * otherwise show a loading or empty state instead of the seeded record and still pass.
 */
export function recordMissingQueryFnReports(queryClient: QueryClient): string[] {
  const reports: string[] = []
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'error') return
    const { error } = event.action
    if (error instanceof Error && error.message.startsWith(MISSING_QUERY_FN)) {
      reports.push(error.message)
    }
  })
  return reports
}
