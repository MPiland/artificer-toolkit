import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type {
  CampaignChatEntryDto,
  ExecuteCampaignPrivateRollInput,
  ExecuteCampaignRollInput,
  RevealCampaignRollInput,
  SendCampaignChatEntryInput
} from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollHistoryEntryDto } from '@artificer-toolkit/schema/api/rolls'
import { useQuery } from '@tanstack/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { useCallback, useState } from 'react'
import { getCampaignLiveAuthority } from '#app/data/campaigns/queries'
import { useCampaignLiveSession } from './useCampaignLiveSession'

/** Room-pushed entries kept per hook; Convex history carries everything older. */
const PUSHED_ENTRY_LIMIT = 200
/** The Convex roll history reads 20 rolls; the room's pushed copies need no more. */
const PUSHED_PRIVATE_ROLL_LIMIT = 20

/**
 * Chat and Campaign rolls for one Campaign. While the live room holds authority they are room
 * commands (D69) and the room's pushed entries arrive here at once; otherwise they stay Convex
 * mutations. The command ID is the entry's client nonce, so a retry replays the original entry.
 * The GM's private rolls and reveals (Q14) follow the same switch.
 */
export function useCampaignChatRoom(campaignId: string | undefined) {
  const authority = useQuery(getCampaignLiveAuthority(campaignId))
  const holdsAuthority = Boolean(authority.data)
  const [pushed, setPushed] = useState<CampaignChatEntryDto[]>([])
  const [pushedPrivateRolls, setPushedPrivateRolls] = useState<RollHistoryEntryDto[]>([])
  const live = useCampaignLiveSession({
    campaignId: campaignId ?? '',
    enabled: holdsAuthority,
    onCampaignChatEntry: (entry) =>
      setPushed((current) =>
        current.some((existing) => existing.id === entry.id)
          ? current
          : [...current, entry].slice(-PUSHED_ENTRY_LIMIT)
      ),
    onPrivateRoll: (roll) =>
      setPushedPrivateRolls((current) =>
        [roll, ...current.filter((existing) => existing.id !== roll.id)].slice(
          0,
          PUSHED_PRIVATE_ROLL_LIMIT
        )
      )
  })
  const { sendCommand } = live
  const sendConvexChat = useConvexMutation(convexApi.campaigns.chat.send)
  const executeConvexRoll = useConvexMutation(convexApi.campaigns.rolls.execute)
  const executeConvexPrivateRoll = useConvexMutation(convexApi.campaigns.rolls.executePrivate)
  const revealConvexRoll = useConvexMutation(convexApi.campaigns.rolls.reveal)

  const requireEntry = useCallback(
    async (command: Parameters<typeof sendCommand>[0]): Promise<CampaignChatEntryDto> => {
      const commit = await sendCommand(command)
      if (commit.delta?.scope !== 'CAMPAIGN_CHAT' || !commit.delta.entry)
        throw new Error('Live play acknowledged the message without an entry.')
      return commit.delta.entry
    },
    [sendCommand]
  )
  const sendChat = useCallback(
    (input: SendCampaignChatEntryInput) =>
      holdsAuthority
        ? requireEntry({
            scope: 'CAMPAIGN_CHAT',
            command: { type: 'SEND_CHAT', commandId: input.clientNonce, input }
          })
        : sendConvexChat(input),
    [holdsAuthority, requireEntry, sendConvexChat]
  )
  const executeRoll = useCallback(
    (input: ExecuteCampaignRollInput) =>
      holdsAuthority
        ? requireEntry({
            scope: 'CAMPAIGN_CHAT',
            command: { type: 'EXECUTE_ROLL', commandId: input.clientNonce, input }
          })
        : executeConvexRoll(input),
    [executeConvexRoll, holdsAuthority, requireEntry]
  )

  const executePrivateRoll = useCallback(
    async (input: ExecuteCampaignPrivateRollInput): Promise<RollHistoryEntryDto> => {
      if (!holdsAuthority) return executeConvexPrivateRoll(input)
      const commit = await sendCommand({
        scope: 'CAMPAIGN_CHAT',
        command: { type: 'EXECUTE_PRIVATE_ROLL', commandId: input.clientNonce, input }
      })
      if (commit.delta?.scope !== 'CAMPAIGN_CHAT' || !commit.delta.privateRoll)
        throw new Error('Live play acknowledged the private roll without its roll.')
      return commit.delta.privateRoll
    },
    [executeConvexPrivateRoll, holdsAuthority, sendCommand]
  )
  // A reveal has no nonce; the room (or Convex) refuses a second reveal of the same roll and mode.
  const revealRoll = useCallback(
    (input: RevealCampaignRollInput) =>
      holdsAuthority && input.campaignId === campaignId
        ? requireEntry({
            scope: 'CAMPAIGN_CHAT',
            command: { type: 'REVEAL_ROLL', commandId: crypto.randomUUID(), input }
          })
        : revealConvexRoll(input),
    [campaignId, holdsAuthority, requireEntry, revealConvexRoll]
  )

  return {
    executePrivateRoll,
    executeRoll,
    pushedEntries: pushed,
    pushedPrivateRolls,
    revealRoll,
    sendChat
  }
}
