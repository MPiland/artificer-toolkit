import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type {
  CampaignChatEntryDto,
  ExecuteCampaignRollInput,
  SendCampaignChatEntryInput
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { useQuery } from '@tanstack/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { useCallback, useState } from 'react'
import { getCampaignChatLiveAuthority } from '#app/data/campaigns/queries'
import { useCampaignLiveSession } from './useCampaignLiveSession'

/** Room-pushed entries kept per hook; Convex history carries everything older. */
const PUSHED_ENTRY_LIMIT = 200

/**
 * Chat and Campaign rolls for one Campaign. While the live room holds authority they are room
 * commands (D69) and the room's pushed entries arrive here at once; otherwise they stay Convex
 * mutations. The command ID is the entry's client nonce, so a retry replays the original entry.
 */
export function useCampaignChatRoom(campaignId: string | undefined) {
  const authority = useQuery(getCampaignChatLiveAuthority(campaignId))
  const holdsAuthority = Boolean(authority.data)
  const [pushed, setPushed] = useState<CampaignChatEntryDto[]>([])
  const live = useCampaignLiveSession({
    campaignId: campaignId ?? '',
    enabled: holdsAuthority,
    onCampaignChatEntry: (entry) =>
      setPushed((current) =>
        current.some((existing) => existing.id === entry.id)
          ? current
          : [...current, entry].slice(-PUSHED_ENTRY_LIMIT)
      )
  })
  const { sendCommand } = live
  const sendConvexChat = useConvexMutation(convexApi.campaigns.chat.send)
  const executeConvexRoll = useConvexMutation(convexApi.campaigns.rolls.execute)

  const requireEntry = useCallback(
    async (command: Parameters<typeof sendCommand>[0]): Promise<CampaignChatEntryDto> => {
      const commit = await sendCommand(command)
      if (commit.delta?.scope !== 'CAMPAIGN_CHAT')
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

  return { executeRoll, pushedEntries: pushed, sendChat }
}
