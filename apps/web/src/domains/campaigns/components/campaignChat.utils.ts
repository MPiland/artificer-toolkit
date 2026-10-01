import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'

/**
 * Entries the live room pushed to one conversation, merged into its Convex history until the
 * room's checkpoint makes Convex carry them. Ordered oldest first, like history.
 */
export function mergeRoomChatEntries(
  history: readonly CampaignChatEntryDto[],
  pushed: readonly CampaignChatEntryDto[],
  conversationId: string | undefined
): readonly CampaignChatEntryDto[] {
  if (!conversationId) return history
  const known = new Set(history.map((entry) => entry.id))
  const extra = pushed.filter(
    (entry) => entry.conversationId === conversationId && !known.has(entry.id)
  )
  if (extra.length === 0) return history
  return [...history, ...extra].sort(
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
  )
}
