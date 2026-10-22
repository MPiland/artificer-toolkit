import { Alert, Button, SegmentedControl, Text, Textarea } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { useMutation, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMutation as useConvexMutation } from 'convex/react'
import { type SubmitEvent, useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { getCampaignConversations } from '#app/data/campaigns/queries'
import { useCampaignChatHistory } from '#app/data/campaigns/useCampaignChatHistory'
import { getRollHistory } from '#app/data/rolls'
import { findOption } from '#app/forms/utils/valueGuards'
import { errorMessage } from '#app/lib/errorMessage'
import { useCampaignChatRoom } from '../vtt/useCampaignChatRoom'
import { CampaignChatHistory } from './CampaignChatHistory'
import { CampaignChatNavigation } from './CampaignChatNavigation'
import * as chatStyles from './CampaignChat.css'
import type { CampaignChatRoom, CampaignRollView } from './campaignChat.types'
import {
  mergeRoomChatEntries,
  mergeRoomPrivateRolls,
  readSavedChatMode
} from './campaignChat.utils'

export function CampaignChat({
  campaign,
  currentUserId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
}) {
  const [rollView, setRollView] = useState<CampaignRollView>(null)
  const {
    encounterSession: roomSession,
    pushedEntries,
    pushedPrivateRolls,
    revealRoll,
    sendChat
  } = useCampaignChatRoom(
    campaign.id,
    campaign.role === 'OWNER' ? { timeline: rollView === 'ENCOUNTER' } : null
  )
  const editEntry = useConvexMutation(convexApi.campaigns.chat.edit)
  const unsendEntry = useConvexMutation(convexApi.campaigns.chat.unsend)
  const markConversationRead = useConvexMutation(convexApi.campaigns.conversations.markRead)
  const [room, setRoom] = useState<CampaignChatRoom>('TABLE')
  const [directUserId, setDirectUserId] = useState<string>()
  const [body, setBody] = useState('')
  const reduceMotion = useReducedMotion()
  const lastMarkedRead = useRef<string | undefined>(undefined)
  const chatLog = useRef<HTMLDivElement>(null)
  const currentMember = campaign.memberships.find((member) => member.userId === currentUserId)
  const assignedCharacter = currentMember?.assignedCharacter ?? null
  const chatModeKey = `campaign:${campaign.id}:chat-mode`
  const [mode, setMode] = useState<'OOC' | 'ROLEPLAY'>(
    () => readSavedChatMode(chatModeKey, Boolean(assignedCharacter)) ?? 'OOC'
  )
  const savedModeScope = `${chatModeKey}:${assignedCharacter?.id ?? ''}`
  const [appliedModeScope, setAppliedModeScope] = useState(savedModeScope)
  if (appliedModeScope !== savedModeScope) {
    setAppliedModeScope(savedModeScope)
    const savedMode = readSavedChatMode(chatModeKey, Boolean(assignedCharacter))
    if (savedMode) setMode(savedMode)
  }
  const conversations = useQuery(getCampaignConversations(campaign.id))
  // The room's Run while it holds the Run; Convex's stored one otherwise. The timeline is the
  // room's alone: with no room there is none to show.
  const storedSession = useQuery(
    convexQuery(
      convexApi.encounters.activeReads.active,
      campaign.role === 'OWNER' && !roomSession ? { campaignId: campaign.id } : 'skip'
    )
  )
  const activeEncounter = (roomSession ? roomSession.state : storedSession.data)?.encounter
  const privateRolls = useQuery(getRollHistory(rollView === 'MINE'))
  const showRolls = rollView !== null
  const history = useCampaignChatHistory(
    {
      campaignId: campaign.id,
      room,
      ...(room === 'DIRECT' && directUserId ? { directUserId } : {})
    },
    `${currentUserId}:${currentMember?.accessStartedAt ?? ''}`,
    campaign.capabilities.readTableChat &&
      !showRolls &&
      (room !== 'DIRECT' || Boolean(directUserId))
  )
  const conversationId = conversations.data?.find(
    (conversation) =>
      conversation.kind === room &&
      (room !== 'DIRECT' ||
        (directUserId && conversation.participantUserIds.includes(directUserId)))
  )?.id
  const entries = mergeRoomChatEntries(history.entries, pushedEntries, conversationId)
  const directMembers = campaign.memberships
    .filter((member) => member.userId !== currentUserId)
    .map((member) => ({
      userId: member.userId,
      username: member.username,
      unreadCount:
        conversations.data?.find(
          (conversation) =>
            conversation.kind === 'DIRECT' &&
            conversation.participantUserIds.includes(member.userId)
        )?.unreadCount ?? 0
    }))
  const selectedDirectMember = directMembers.find((member) => member.userId === directUserId)
  const newestEntryId = entries.at(-1)?.id

  useEffect(() => {
    if (!newestEntryId) return
    chatLog.current?.scrollTo({
      top: chatLog.current.scrollHeight,
      behavior: reduceMotion ? 'auto' : 'smooth'
    })
  }, [newestEntryId, reduceMotion])

  const { mutate: markRead } = useMutation({
    mutationFn: (entry: CampaignChatEntryDto) =>
      markConversationRead({
        campaignId: campaign.id,
        conversationId: entry.conversationId,
        entryId: entry.id
      })
  })

  useEffect(() => {
    const newest = entries.at(-1)
    const readKey = newest ? `${newest.conversationId}:${newest.id}` : undefined
    if (
      !showRolls &&
      newest &&
      readKey &&
      lastMarkedRead.current !== readKey &&
      history.unreadCount > 0
    ) {
      lastMarkedRead.current = readKey
      markRead(newest, {
        onError: () => {
          if (lastMarkedRead.current === readKey) lastMarkedRead.current = undefined
        }
      })
    }
  }, [entries, history.unreadCount, markRead, showRolls])

  const send = useMutation({
    mutationFn: () =>
      sendChat({
        campaignId: campaign.id,
        room,
        directUserId: room === 'DIRECT' ? directUserId : undefined,
        mode,
        body,
        assignedCharacterId: mode === 'ROLEPLAY' ? assignedCharacter?.id : undefined,
        clientNonce: crypto.randomUUID()
      }),
    onSuccess: () => {
      setBody('')
    }
  })
  const entryAction = useMutation({
    mutationFn: async (
      action:
        | { kind: 'EDIT'; entry: CampaignChatEntryDto }
        | { kind: 'UNSEND'; entry: CampaignChatEntryDto }
    ) => {
      if (action.kind === 'UNSEND') {
        return unsendEntry({ campaignId: campaign.id, entryId: action.entry.id })
      }
      const nextBody = window.prompt('Edit message', action.entry.body ?? '')
      if (nextBody === null || nextBody.trim() === '') return action.entry
      return editEntry({ campaignId: campaign.id, entryId: action.entry.id, body: nextBody })
    }
  })

  function submitMessage(event: SubmitEvent) {
    event.preventDefault()
    if (!body.trim() || send.isPending) return
    send.mutate()
  }

  function selectRoom(nextRoom: Exclude<CampaignChatRoom, 'DIRECT'>) {
    setRollView(null)
    setRoom(nextRoom)
    setDirectUserId(undefined)
  }

  function selectDirect(userId: string) {
    setRollView(null)
    setRoom('DIRECT')
    setDirectUserId(userId)
  }

  if (!campaign.capabilities.readTableChat) {
    return <Alert color='red'>You do not have access to this Campaign chat.</Alert>
  }

  const error =
    send.error ?? entryAction.error ?? history.error ?? conversations.error ?? storedSession.error
  const roomUnread = (kind: Exclude<CampaignChatRoom, 'DIRECT'>) =>
    conversations.data?.find((conversation) => conversation.kind === kind)?.unreadCount ?? 0
  const directUnread = directMembers.reduce((total, member) => total + member.unreadCount, 0)
  const conversationLabel = showRolls
    ? rollView === 'ENCOUNTER'
      ? 'Enemy rolls'
      : 'My rolls'
    : room === 'TABLE'
      ? 'Table'
      : room === 'PARTY'
        ? 'Party'
        : selectedDirectMember
          ? `@${selectedDirectMember.username}`
          : 'Direct messages'

  return (
    <section className={chatStyles.chatDrawerContent} aria-label='Campaign chat'>
      <CampaignChatNavigation
        canReadPartyChat={campaign.capabilities.readPartyChat}
        directMembers={directMembers}
        directUnread={directUnread}
        hasActiveEncounter={campaign.role === 'OWNER' && Boolean(activeEncounter)}
        room={room}
        roomUnread={{ TABLE: roomUnread('TABLE'), PARTY: roomUnread('PARTY') }}
        rollView={rollView}
        onSelectDirect={selectDirect}
        onSelectRollView={setRollView}
        onSelectRoom={selectRoom}
      />

      {error ? <Alert color='red'>{errorMessage(error)}</Alert> : null}
      <CampaignChatHistory
        chatLog={chatLog}
        conversationLabel={conversationLabel}
        currentUserId={currentUserId}
        directUserId={directUserId}
        encounterEntries={roomSession?.timeline?.entries}
        entries={entries}
        hasNextPage={history.hasNextPage}
        isHistoryLoading={history.isLoading}
        isLoadingOlderMessages={history.isFetchingNextPage}
        isPrivateRollsError={privateRolls.isError}
        isPrivateRollsPending={privateRolls.isPending}
        privateRolls={mergeRoomPrivateRolls(privateRolls.data, pushedPrivateRolls)}
        rollView={rollView}
        room={room}
        onEntryAction={entryAction.mutate}
        onLoadOlderMessages={() => void history.fetchNextPage()}
        onRevealRoll={revealRoll}
      />

      {!showRolls && (room !== 'DIRECT' || directUserId) && campaign.status === 'ACTIVE' ? (
        <form className={chatStyles.chatComposer} onSubmit={submitMessage}>
          <Textarea
            autosize
            aria-label={`Message ${conversationLabel}`}
            classNames={{ input: chatStyles.chatComposerInput }}
            maxLength={2000}
            maxRows={6}
            minRows={2}
            placeholder={`Message ${conversationLabel}`}
            required
            value={body}
            onChange={(event) => setBody(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }}
          />
          <div className={chatStyles.chatComposerToolbar}>
            <SegmentedControl
              aria-label='Message voice'
              className={chatStyles.chatVoice}
              data={[
                { label: `@${currentMember?.username ?? 'username'}`, value: 'OOC' },
                ...(assignedCharacter
                  ? [{ label: assignedCharacter.label, value: 'ROLEPLAY' }]
                  : [])
              ]}
              size='xs'
              value={mode}
              onChange={(value) => {
                const nextMode = findOption(['OOC', 'ROLEPLAY'], value) ?? 'OOC'
                setMode(nextMode)
                window.localStorage.setItem(chatModeKey, nextMode)
              }}
            />
            <Button
              disabled={!body.trim()}
              leftSection={<Send aria-hidden='true' size={15} />}
              loading={send.isPending}
              size='compact-sm'
              type='submit'
            >
              Send
            </Button>
            <Text aria-live='polite' c='dimmed' size='sm'>
              {send.isPending ? 'Sending…' : send.isSuccess ? 'Sent.' : ''}
            </Text>
          </div>
        </form>
      ) : null}
    </section>
  )
}
