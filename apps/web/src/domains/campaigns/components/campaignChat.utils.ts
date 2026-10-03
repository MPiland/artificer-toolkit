import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollHistoryEntryDto } from '@artificer-toolkit/schema/api/rolls'

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
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
  )
}

/**
 * The GM's private rolls the live room holds, merged over Convex history until the room's
 * checkpoint makes Convex carry them. A pushed roll replaces its Convex copy; newest first.
 */
export function mergeRoomPrivateRolls(
  history: readonly RollHistoryEntryDto[] | undefined,
  pushed: readonly RollHistoryEntryDto[]
): readonly RollHistoryEntryDto[] | undefined {
  if (!history || pushed.length === 0) return history
  const pushedIds = new Set(pushed.map((roll) => roll.id))
  return [...pushed, ...history.filter((roll) => !pushedIds.has(roll.id))].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
  )
}
