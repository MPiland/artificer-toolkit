import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type {
  CampaignChatEntryDto,
  CampaignChatPageDto
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useConvex, useMutation } from 'convex/react'
import type { FunctionArgs } from 'convex/server'
import { useEffect, useState } from 'react'
import { getCampaignChat } from './queries'

type ChatHistory = {
  scopeKey: string
  /** The newest page that `older` was last reconciled with. */
  head?: CampaignChatPageDto
  /** Entries older than `head`, newest first; null until older history is first requested. */
  older: CampaignChatEntryDto[] | null
  exhausted: boolean
  loadingCursor?: string
  error?: Error
}

const newerThan = (left: CampaignChatEntryDto, right: CampaignChatEntryDto) =>
  left.createdAt > right.createdAt || (left.createdAt === right.createdAt && left.id > right.id)

/**
 * Keeps loaded history contiguous with a new newest page. Entries that slide out of the newest
 * page join the older history. When the new page does not reach back to the previous one, the
 * entries between them were never seen, so older history starts again from the new page.
 */
function followHead(history: ChatHistory, next: CampaignChatPageDto): ChatHistory {
  const { head, older } = history
  if (!older || !head) return { ...history, head: next }
  if (next.nextCursor === null) return { ...history, head: next, older: [], exhausted: true }
  const oldestNext = next.entries.at(-1)
  const newestPrevious = head.entries[0]
  if (!oldestNext || !newestPrevious) return { ...history, head: next }
  if (newerThan(oldestNext, newestPrevious))
    return { ...history, head: next, older: [], exhausted: false }
  const slid = head.entries.filter((entry) => newerThan(oldestNext, entry))
  return { ...history, head: next, older: [...slid, ...older] }
}

function olderCursor({ head, older, exhausted }: ChatHistory) {
  if (!older?.length) return head?.nextCursor ?? null
  return exhausted ? null : older.at(-1)!.id
}

/**
 * Subscribes to the newest page only. Older pages are read once on request and kept in order
 * below it, so a new message re-runs one page rather than every page the reader scrolled through.
 */
export function useCampaignChatHistory(
  scope: Omit<FunctionArgs<typeof convexApi.campaigns.chat.list>, 'cursor' | 'limit'>,
  accessKey: string,
  enabled: boolean
) {
  const { campaignId, room, directUserId } = scope
  const scopeKey = JSON.stringify([campaignId, room, directUserId, accessKey])
  const [opened, setOpened] = useState<{ scopeKey: string; error?: Error }>()
  const openConversation = useMutation(convexApi.campaigns.conversations.open)
  const convex = useConvex()

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

  const openError = enabled && opened?.scopeKey === scopeKey ? opened.error : undefined
  const ready = enabled && opened?.scopeKey === scopeKey && !opened.error
  const head = useQuery(
    ready
      ? getCampaignChat(campaignId, room, directUserId)
      : convexQuery(convexApi.campaigns.chat.list, 'skip')
  )
  const headPage = ready && !head.error ? head.data : undefined

  const [saved, setHistory] = useState<ChatHistory>({ scopeKey, older: null, exhausted: false })
  let history = saved.scopeKey === scopeKey ? saved : { scopeKey, older: null, exhausted: false }
  if (headPage && headPage !== history.head) history = followHead(history, headPage)
  if (history !== saved) setHistory(history)

  const cursor = olderCursor(history)
  return {
    entries: headPage ? [...headPage.entries, ...(history.older ?? [])].reverse() : [],
    error: openError ?? (ready ? head.error : null) ?? history.error,
    unreadCount: headPage?.unreadCount ?? 0,
    isLoading: enabled && !openError && !head.error && !headPage,
    isFetchingNextPage: Boolean(history.loadingCursor),
    hasNextPage: Boolean(headPage && cursor),
    fetchNextPage: () => {
      if (!headPage || !cursor || history.loadingCursor) return
      const requested = cursor
      setHistory((current) =>
        current.scopeKey === scopeKey
          ? { ...current, older: current.older ?? [], loadingCursor: requested, error: undefined }
          : current
      )
      const settle = (update: (current: ChatHistory) => ChatHistory) =>
        setHistory((current) =>
          current.scopeKey !== scopeKey || current.loadingCursor !== requested
            ? current
            : update({ ...current, loadingCursor: undefined })
        )
      convex
        .query(convexApi.campaigns.chat.list, {
          campaignId,
          room,
          ...(room === 'DIRECT' && directUserId ? { directUserId } : {}),
          cursor: requested,
          limit: 50
        })
        .then(
          (page) =>
            settle((current) =>
              // A newest page that jumped past this history has already restarted it.
              olderCursor(current) === requested
                ? {
                    ...current,
                    older: [...(current.older ?? []), ...page.entries],
                    exhausted: page.nextCursor === null
                  }
                : current
            ),
          (failure: unknown) =>
            settle((current) => ({
              ...current,
              error:
                failure instanceof Error
                  ? failure
                  : new Error('Conversation history could not be loaded.')
            }))
        )
    }
  }
}
