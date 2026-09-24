import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { CampaignChatPageDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import { useQueries } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import type { FunctionArgs } from 'convex/server'
import { useEffect, useState } from 'react'
import { getCampaignChat } from './queries'

export function useCampaignChatHistory(
  scope: Omit<FunctionArgs<typeof convexApi.campaigns.chat.list>, 'cursor' | 'limit'>,
  accessKey: string,
  enabled: boolean
) {
  const { campaignId, room, directUserId } = scope
  const scopeKey = JSON.stringify([campaignId, room, directUserId, accessKey])
  const initial = { scopeKey, cursors: [undefined] as (string | undefined)[], pageCount: 1 }
  const [saved, setPagination] = useState(initial)
  const pagination = saved.scopeKey === scopeKey ? saved : initial
  if (pagination !== saved) setPagination(pagination)
  const [opened, setOpened] = useState<{ scopeKey: string; error?: Error }>()
  const openConversation = useMutation(convexApi.campaigns.conversations.open)

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    void openConversation({
      campaignId,
      kind: room,
      ...(room === 'DIRECT' && directUserId ? { directUserId } : {})
    }).then(
      () => {
        if (!disposed) setOpened({ scopeKey })
      },
      (error: unknown) => {
        if (!disposed)
          setOpened({
            scopeKey,
            error: error instanceof Error ? error : new Error('Conversation could not be opened.')
          })
      }
    )
    return () => {
      disposed = true
    }
  }, [campaignId, directUserId, enabled, openConversation, room, scopeKey])

  const ready = enabled && opened?.scopeKey === scopeKey && !opened.error
  const queries = useQueries({
    queries: ready
      ? pagination.cursors.map((cursor) => getCampaignChat(campaignId, room, directUserId, cursor))
      : []
  })
  const cursors: (string | undefined)[] = [undefined]
  const pages: CampaignChatPageDto[] = []
  let error = enabled && opened?.scopeKey === scopeKey ? opened.error : undefined
  let pending = enabled
  let hasNextPage = false
  for (const [index, query] of queries.entries()) {
    // A changed live boundary discards the old tail before any cached rows can be shown.
    if (pagination.cursors[index] !== cursors[index]) break
    if (query.error) {
      error = query.error
      break
    }
    if (!query.data) break
    pages.push(query.data)
    const next = query.data.nextCursor
    if (!next || pages.length === pagination.pageCount) {
      hasNextPage = Boolean(next)
      pending = false
      break
    }
    if (cursors.includes(next)) {
      error = new Error('Conversation history could not be paged.')
      break
    }
    cursors.push(next)
  }
  useEffect(() => {
    if (!ready) return
    if (
      pagination.cursors.length !== cursors.length ||
      pagination.cursors.some((cursor, index) => cursor !== cursors[index])
    )
      setPagination((current) => (current === pagination ? { ...current, cursors } : current))
  }, [cursors, pagination, ready])

  const entries = error
    ? []
    : [
        ...new Map(pages.flatMap((page) => page.entries).map((entry) => [entry.id, entry])).values()
      ].sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
      )
  return {
    entries,
    error,
    unreadCount: error ? 0 : (pages[0]?.unreadCount ?? 0),
    isLoading: pending && !error && pages.length === 0,
    isFetchingNextPage: pending && !error && pages.length > 0,
    hasNextPage: !error && hasNextPage,
    fetchNextPage: () => {
      if (!pending && !error && hasNextPage)
        setPagination((current) =>
          current === pagination ? { ...current, pageCount: current.pageCount + 1 } : current
        )
    }
  }
}
