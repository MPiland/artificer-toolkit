import type { SystemListResponseDto } from '@artificer-toolkit/schema/api/systems'
import { useQueries } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getSystemListPage } from './queries'

export function useSystemList(enabled = true) {
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const queries = useQueries({
    queries: enabled ? cursors.map((cursor) => getSystemListPage(cursor)) : []
  })
  const nextCursors: (string | null)[] = [null]
  const systems: SystemListResponseDto = []
  let isDone = false
  let isError = false
  for (const [index, query] of queries.entries()) {
    // A changed boundary invalidates the old tail, even if its pages are cached.
    if (cursors[index] !== nextCursors[index]) break
    if (query.isError) {
      isError = true
      break
    }
    if (!query.data) break
    systems.push(...query.data.page)
    if (query.data.isDone) {
      isDone = true
      break
    }
    const next = query.data.continueCursor
    if (!next || nextCursors.includes(next)) {
      isError = true
      break
    }
    nextCursors.push(next)
  }

  useEffect(() => {
    if (
      cursors.length !== nextCursors.length ||
      cursors.some((cursor, index) => cursor !== nextCursors[index])
    ) {
      setCursors(nextCursors)
    }
  }, [cursors, nextCursors])

  if (isError) return { data: undefined, isPending: false, isError: true } as const
  if (!isDone) return { data: undefined, isPending: true, isError: false } as const
  return { data: systems, isPending: false, isError: false } as const
}
