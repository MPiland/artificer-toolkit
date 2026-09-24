import type {
  AuthoredCataloguePage,
  AuthoredCatalogueReadInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { useQueries } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getAuthoredCatalogueList } from './authoredCatalogue'

export function useAuthoredCatalogueWindow(
  scope: Omit<AuthoredCatalogueReadInput, 'paginationOpts'>
) {
  const scopeKey = JSON.stringify([
    scope.subjectKind,
    scope.systemId,
    scope.source,
    scope.category,
    scope.classId,
    scope.level,
    scope.magicSchoolId,
    scope.sort
  ])
  const initial = {
    scopeKey,
    ranges: [{ cursor: null }] as Array<{
      cursor: string | null
      endCursor?: string
      placeholder?: AuthoredCataloguePage
    }>,
    start: 0
  }
  const [saved, setWindow] = useState(initial)
  const window = saved.scopeKey === scopeKey ? saved : initial
  if (window !== saved) setWindow(window)
  // Keep boundary history for backward loading, but only five live pages of rows.
  const ranges = window.ranges.slice(window.start, window.start + 5)
  const queries = useQueries({
    queries: ranges.map(({ cursor, endCursor, placeholder }) => ({
      ...getAuthoredCatalogueList({
        ...scope,
        paginationOpts: { cursor, endCursor, numItems: 48 }
      }),
      placeholderData: placeholder
    }))
  })
  const splitIndex = queries.findIndex(
    (query) => !query.isPlaceholderData && query.data?.pageStatus
  )
  const splitPage = queries[splitIndex]?.data
  const splitRange = ranges[splitIndex]
  const splitCursor = splitPage?.splitCursor
  const invalidSplit = Boolean(
    splitPage &&
    (!splitCursor || splitCursor === splitRange.cursor || splitCursor === splitRange.endCursor)
  )
  const pending =
    queries.some((query) => query.isPending || query.isPlaceholderData) || splitIndex !== -1
  const lastPage = queries.at(-1)?.data
  const end = window.start + ranges.length
  const invalidContinuation = Boolean(
    lastPage && !lastPage.isDone && lastPage.continueCursor === ranges.at(-1)?.cursor
  )
  const isError = queries.some((query) => query.isError) || invalidSplit || invalidContinuation
  const hasNextPage = end < window.ranges.length || Boolean(lastPage && !lastPage.isDone)

  useEffect(() => {
    const completed = ranges.flatMap((range, index) =>
      range.placeholder && !queries[index]!.isPlaceholderData ? [window.start + index] : []
    )
    if (!completed.length) return
    setWindow((current) =>
      current !== window
        ? current
        : {
            ...current,
            ranges: current.ranges.map((range, index) =>
              completed.includes(index)
                ? { cursor: range.cursor, endCursor: range.endCursor }
                : range
            )
          }
    )
  }, [queries, ranges, window])

  useEffect(() => {
    if (!splitPage || !splitCursor || invalidSplit) return
    const index = window.start + splitIndex
    setWindow((current) => {
      if (current !== window) return current
      return {
        ...current,
        ranges: [
          ...current.ranges.slice(0, index),
          { cursor: splitRange.cursor, endCursor: splitCursor },
          {
            cursor: splitCursor,
            // A required split may stop before the original fixed boundary.
            endCursor: splitRange.endCursor ?? splitPage.continueCursor
          },
          ...current.ranges.slice(index + 1)
        ]
      }
    })
  }, [invalidSplit, splitCursor, splitIndex, splitPage, splitRange, window])

  const fetchNextPage = () => {
    if (pending || isError || !hasNextPage || !lastPage) return
    setWindow((current) => {
      if (current !== window) return current
      if (end < current.ranges.length) return { ...current, start: current.start + 1 }
      return {
        ...current,
        start: Math.max(0, current.ranges.length + 1 - 5),
        ranges: [
          ...current.ranges.slice(0, -1),
          // Retain only this currently displayed range while its fixed-key read arrives.
          { ...ranges.at(-1)!, endCursor: lastPage.continueCursor, placeholder: lastPage },
          { cursor: lastPage.continueCursor }
        ]
      }
    })
  }
  const fetchPreviousPage = () => {
    if (pending || isError || window.start === 0) return
    setWindow((current) =>
      current === window ? { ...current, start: current.start - 1 } : current
    )
  }
  const pages = []
  for (const query of queries) {
    if (!query.data || query.data.pageStatus === 'SplitRequired' || query.isError) {
      if (pages.length) break
      continue
    }
    pages.push(query.data)
  }
  const items = pages.flatMap((page) => page.page)

  useEffect(() => {
    // Empty ranges after live deletions still need to reach the next populated page.
    if (items.length === 0) fetchNextPage()
  })

  return {
    items: isError ? [] : items,
    isError,
    isPending: pending && items.length === 0,
    hasNextPage,
    hasPreviousPage: window.start > 0,
    isFetchingNextPage: pending,
    isFetchingPreviousPage: pending,
    fetchNextPage,
    fetchPreviousPage
  }
}
