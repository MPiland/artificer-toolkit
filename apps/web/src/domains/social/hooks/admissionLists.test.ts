import { describe, expect, it } from 'vitest'
import { mergeAdmissionRows, type AdmissionPage } from './admissionLists'

interface Row {
  id: string
  state: 'PENDING' | 'DONE'
}

function page(
  results: Row[],
  status: AdmissionPage<Row>['status'] = 'Exhausted'
): AdmissionPage<Row> {
  return { results, status, loadMore: () => undefined }
}

const options = { isPending: (row: Row) => row.state === 'PENDING', getKey: (row: Row) => row.id }

describe('mergeAdmissionRows', () => {
  it('lists pending before history and reports an exhausted empty list', () => {
    const pending = { id: 'a', state: 'PENDING' } as const
    const done = { id: 'b', state: 'DONE' } as const

    expect(
      mergeAdmissionRows({
        pending: page([pending]),
        history: page([done]),
        direct: undefined,
        ...options
      }).rows
    ).toEqual([pending, done])
    expect(
      mergeAdmissionRows({ pending: page([]), history: page([]), direct: undefined, ...options })
        .exhaustedEmpty
    ).toBe(true)
  })

  it('shows a deep-linked row in its own group and does not duplicate it once its page loads', () => {
    const direct: Row = { id: 'd', state: 'DONE' }
    const before = mergeAdmissionRows({
      pending: page([]),
      history: page([], 'LoadingFirstPage'),
      direct,
      ...options
    })
    expect(before.rows).toEqual([direct])
    expect(before.loadingFirstPage).toBe(true)
    expect(before.exhaustedEmpty).toBe(false)

    const after = mergeAdmissionRows({
      pending: page([]),
      history: page([direct]),
      direct,
      ...options
    })
    expect(after.rows).toEqual([direct])
  })

  it('keeps the pending copy of a row that both groups report', () => {
    const live: Row = { id: 'a', state: 'PENDING' }
    const stale: Row = { id: 'a', state: 'DONE' }

    expect(
      mergeAdmissionRows({
        pending: page([live]),
        history: page([stale]),
        direct: undefined,
        ...options
      }).rows
    ).toEqual([live])
  })

  it('reports loading more while either page loads more', () => {
    expect(
      mergeAdmissionRows({
        pending: page([], 'CanLoadMore'),
        history: page([], 'LoadingMore'),
        direct: undefined,
        ...options
      }).loadingMore
    ).toBe(true)
  })
})
