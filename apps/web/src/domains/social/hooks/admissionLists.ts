export const admissionPageSize = 24

type AdmissionListStatus = 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'

export interface AdmissionPage<Row> {
  results: Row[]
  status: AdmissionListStatus
  loadMore: (numItems: number) => void
}

/**
 * Merges a PENDING and a HISTORY page with an optional directly-addressed row (a deep link),
 * which joins whichever group its own state belongs to so it shows even before its page loads.
 */
export function mergeAdmissionRows<Row>({
  pending,
  history,
  direct,
  isPending,
  getKey
}: {
  pending: AdmissionPage<Row>
  history: AdmissionPage<Row>
  direct: Row | undefined
  isPending: (row: Row) => boolean
  getKey: (row: Row) => string
}) {
  const pendingRows = direct && isPending(direct) ? [direct, ...pending.results] : pending.results
  const historyRows = direct && !isPending(direct) ? [direct, ...history.results] : history.results
  const merged = new Map<string, Row>()
  for (const row of [...pendingRows, ...historyRows]) merged.set(getKey(row), row)
  const rows = [...merged.values()]
  return {
    rows,
    loadingFirstPage:
      pending.status === 'LoadingFirstPage' || history.status === 'LoadingFirstPage',
    loadingMore: pending.status === 'LoadingMore' || history.status === 'LoadingMore',
    exhaustedEmpty:
      pending.status === 'Exhausted' && history.status === 'Exhausted' && rows.length === 0
  }
}
