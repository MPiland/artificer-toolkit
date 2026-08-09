import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Menu,
  SegmentedControl,
  Text,
  Textarea
} from '@mantine/core'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type SubmitEvent, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, MoreHorizontal, Send } from 'lucide-react'
import type { CampaignChatEntryDto, CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignChat, getCampaignConversations } from '#app/data/campaigns/queries'
import { getCampaignEncounters, getEncounterTimeline } from '#app/data/encounters/queries'
import { getRollHistory } from '#app/data/rolls'
import { queryKeys } from '#app/lib/queryKeys'
import { formatRollEvidence } from '#app/domains/characters/sheet/dice/dice.utils'
import * as styles from '../campaigns.css'
import * as chatStyles from './CampaignChat.css'

export function CampaignChat({
  campaign,
  currentUserId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
}) {
  const queryClient = useQueryClient()
  const [room, setRoom] = useState<'TABLE' | 'PARTY' | 'DIRECT'>('TABLE')
  const [directUserId, setDirectUserId] = useState<string>()
  const [rollView, setRollView] = useState<'MINE' | 'ENCOUNTER' | null>(null)
  const [mode, setMode] = useState<'OOC' | 'ROLEPLAY'>('OOC')
  const [body, setBody] = useState('')
  const lastMarkedRead = useRef<string | undefined>(undefined)
  const chatLog = useRef<HTMLDivElement>(null)
  const currentMember = campaign.memberships.find((member) => member.userId === currentUserId)
  const assignedCharacter = currentMember?.assignedCharacter ?? null
  const conversations = useQuery(getCampaignConversations(campaign.id))
  const encounters = useQuery({
    ...getCampaignEncounters(campaign.id),
    enabled: campaign.role === 'OWNER'
  })
  const activeEncounter = encounters.data?.find((encounter) => encounter.status === 'ACTIVE')
  const encounterTimeline = useQuery({
    ...getEncounterTimeline(activeEncounter?.id ?? ''),
    enabled: rollView === 'ENCOUNTER' && Boolean(activeEncounter)
  })
  const privateRolls = useQuery({ ...getRollHistory(), enabled: rollView === 'MINE' })
  const showRolls = rollView !== null
  const history = useInfiniteQuery({
    ...getCampaignChat(campaign.id, room, api, directUserId),
    enabled: !showRolls && (room !== 'DIRECT' || Boolean(directUserId))
  })
  const entries = useMemo(
    () =>
      (history.data?.pages.flatMap((page) => page.entries) ?? [])
        .filter((entry, index, all) => all.findIndex((item) => item.id === entry.id) === index)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [history.data]
  )
  const directMembers = campaign.memberships.filter((member) => member.userId !== currentUserId)
  const selectedDirectMember = directMembers.find((member) => member.userId === directUserId)
  const newestEntryId = entries.at(-1)?.id

  useEffect(() => {
    const savedMode = window.localStorage.getItem(`campaign:${campaign.id}:chat-mode`)
    if (savedMode === 'OOC' || (savedMode === 'ROLEPLAY' && assignedCharacter)) {
      setMode(savedMode)
    }
  }, [assignedCharacter, campaign.id])

  useEffect(() => {
    window.localStorage.setItem(`campaign:${campaign.id}:chat-mode`, mode)
  }, [campaign.id, mode])

  useEffect(() => {
    if (!newestEntryId) return
    chatLog.current?.scrollTo({ top: chatLog.current.scrollHeight, behavior: 'smooth' })
  }, [newestEntryId])

  function refreshChat() {
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.chat(campaign.id, room, directUserId)
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.conversations(campaign.id) })
    ])
  }

  const { mutate: markRead } = useMutation({
    mutationFn: (entry: CampaignChatEntryDto) =>
      api.campaigns.conversations.markRead({
        campaignId: campaign.id,
        conversationId: entry.conversationId,
        entryId: entry.id
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.conversations(campaign.id) })
  })

  useEffect(() => {
    const newest = entries.at(-1)
    const readKey = newest ? `${newest.conversationId}:${newest.id}` : undefined
    if (
      !showRolls &&
      newest &&
      readKey &&
      lastMarkedRead.current !== readKey &&
      (history.data?.pages[0]?.unreadCount ?? 0) > 0
    ) {
      lastMarkedRead.current = readKey
      markRead(newest, {
        onError: () => {
          if (lastMarkedRead.current === readKey) lastMarkedRead.current = undefined
        }
      })
    }
  }, [entries, history.data?.pages, markRead, showRolls])

  const send = useMutation({
    mutationFn: () =>
      api.campaigns.chat.send({
        campaignId: campaign.id,
        room,
        directUserId: room === 'DIRECT' ? directUserId : undefined,
        mode,
        body,
        assignedCharacterId: mode === 'ROLEPLAY' ? assignedCharacter?.id : undefined,
        clientNonce: crypto.randomUUID()
      }),
    onSuccess: async () => {
      setBody('')
      await refreshChat()
    }
  })
  const entryAction = useMutation({
    mutationFn: async (
      action:
        | { kind: 'EDIT'; entry: CampaignChatEntryDto }
        | { kind: 'UNSEND'; entry: CampaignChatEntryDto }
    ) => {
      if (action.kind === 'UNSEND') {
        return api.campaigns.chat.unsend(campaign.id, action.entry.id)
      }
      const nextBody = window.prompt('Edit message', action.entry.body ?? '')
      if (nextBody === null || nextBody.trim() === '') return action.entry
      return api.campaigns.chat.edit(campaign.id, action.entry.id, nextBody)
    },
    onSuccess: refreshChat
  })

  function submitMessage(event: SubmitEvent) {
    event.preventDefault()
    if (!body.trim() || send.isPending) return
    send.mutate()
  }

  if (!campaign.capabilities.readTableChat) {
    return <Alert color='red'>You do not have access to this Campaign chat.</Alert>
  }

  const error = send.error ?? entryAction.error
  const roomUnread = (kind: 'TABLE' | 'PARTY') =>
    conversations.data?.find((conversation) => conversation.kind === kind)?.unreadCount ?? 0
  const directUnread =
    conversations.data
      ?.filter((conversation) => conversation.kind === 'DIRECT')
      .reduce((total, conversation) => total + conversation.unreadCount, 0) ?? 0
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

  function selectRoom(nextRoom: 'TABLE' | 'PARTY') {
    setRollView(null)
    setRoom(nextRoom)
    setDirectUserId(undefined)
  }

  function selectDirect(userId: string) {
    setRollView(null)
    setRoom('DIRECT')
    setDirectUserId(userId)
  }

  return (
    <section className={styles.chatDrawerContent} aria-label='Campaign chat'>
      <nav aria-label='Campaign conversations' className={styles.chatNavigator}>
        <Group className={chatStyles.navigationRow} gap='xs' wrap='nowrap'>
          <Button
            aria-pressed={!showRolls && room === 'TABLE'}
            className={chatStyles.navigationButton}
            size='compact-sm'
            variant={!showRolls && room === 'TABLE' ? 'light' : 'subtle'}
            onClick={() => selectRoom('TABLE')}
          >
            Table{' '}
            {roomUnread('TABLE') ? (
              <Badge
                aria-label={`${roomUnread('TABLE')} unread`}
                className={chatStyles.navigationBadge}
                size='xs'
              >
                {roomUnread('TABLE')}
              </Badge>
            ) : null}
          </Button>
          {campaign.capabilities.readPartyChat ? (
            <Button
              aria-pressed={!showRolls && room === 'PARTY'}
              className={chatStyles.navigationButton}
              size='compact-sm'
              variant={!showRolls && room === 'PARTY' ? 'light' : 'subtle'}
              onClick={() => selectRoom('PARTY')}
            >
              Party{' '}
              {roomUnread('PARTY') ? (
                <Badge
                  aria-label={`${roomUnread('PARTY')} unread`}
                  className={chatStyles.navigationBadge}
                  size='xs'
                >
                  {roomUnread('PARTY')}
                </Badge>
              ) : null}
            </Button>
          ) : null}
          <Button
            aria-pressed={rollView === 'MINE'}
            className={chatStyles.navigationButton}
            size='compact-sm'
            variant={rollView === 'MINE' ? 'light' : 'subtle'}
            onClick={() => setRollView('MINE')}
          >
            My rolls
          </Button>
          {campaign.role === 'OWNER' && activeEncounter ? (
            <Button
              aria-pressed={rollView === 'ENCOUNTER'}
              className={chatStyles.navigationButton}
              size='compact-sm'
              variant={rollView === 'ENCOUNTER' ? 'light' : 'subtle'}
              onClick={() => setRollView('ENCOUNTER')}
            >
              Enemy rolls
            </Button>
          ) : null}
          <Menu position='bottom-start' withinPortal>
            <Menu.Target>
              <Button
                aria-label='Direct messages'
                aria-pressed={!showRolls && room === 'DIRECT'}
                className={chatStyles.navigationButton}
                rightSection={<ChevronDown aria-hidden='true' size={14} />}
                size='compact-sm'
                variant={!showRolls && room === 'DIRECT' ? 'light' : 'subtle'}
              >
                Direct{' '}
                {directUnread ? (
                  <Badge
                    aria-label={`${directUnread} unread`}
                    className={chatStyles.navigationBadge}
                    size='xs'
                  >
                    {directUnread}
                  </Badge>
                ) : null}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {directMembers.map((member) => {
                const unread = conversations.data?.find(
                  (conversation) =>
                    conversation.kind === 'DIRECT' &&
                    conversation.participantUserIds.includes(member.userId)
                )?.unreadCount
                return (
                  <Menu.Item key={member.userId} onClick={() => selectDirect(member.userId)}>
                    <Group gap='xs' justify='space-between' wrap='nowrap'>
                      <Text truncate>@{member.username}</Text>
                      {unread ? (
                        <Badge aria-label={`${unread} unread`} size='xs'>
                          {unread}
                        </Badge>
                      ) : null}
                    </Group>
                  </Menu.Item>
                )
              })}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </nav>

      {error ? <Alert color='red'>{error.message}</Alert> : null}
      <div
        className={styles.chatLog}
        aria-label={`${conversationLabel} history`}
        aria-live='polite'
        role='log'
        ref={chatLog}
      >
        {!showRolls && history.hasNextPage ? (
          <Button
            className={chatStyles.historyControl}
            loading={history.isFetchingNextPage}
            size='compact-sm'
            variant='subtle'
            onClick={() => void history.fetchNextPage()}
          >
            Load older messages
          </Button>
        ) : null}
        {rollView === 'MINE' && privateRolls.isPending ? (
          <Text c='dimmed'>Loading rolls…</Text>
        ) : null}
        {rollView === 'MINE' && privateRolls.isError ? (
          <Text c='red'>Roll history could not be loaded.</Text>
        ) : null}
        {rollView === 'MINE' && !privateRolls.isPending && !privateRolls.data?.length ? (
          <Text c='dimmed'>No private rolls yet.</Text>
        ) : null}
        {rollView === 'MINE'
          ? privateRolls.data?.map((privateRoll) => (
              <div
                className={clsx(styles.chatMessageRow, styles.chatMessageRowOwn)}
                key={privateRoll.id}
              >
                <article
                  aria-label='Private roll'
                  className={clsx(styles.chatBubble, styles.chatBubbleOwn, chatStyles.rollBubble)}
                >
                  <div className={styles.chatMessageMeta}>
                    <Text className={styles.chatAuthor} fw={600} size='sm'>
                      {privateRoll.source.label}
                    </Text>
                    <Text c='dimmed' size='xs'>
                      {formatChatTime(privateRoll.createdAt)}
                    </Text>
                  </div>
                  <Text>
                    Rolled <strong>{privateRoll.evidence.total}</strong>
                  </Text>
                  <Text c='dimmed' size='xs'>
                    {formatRollEvidence(privateRoll.evidence)}
                  </Text>
                </article>
              </div>
            ))
          : null}
        {rollView === 'ENCOUNTER' && encounterTimeline.isPending ? (
          <Text c='dimmed'>Loading enemy rolls…</Text>
        ) : null}
        {rollView === 'ENCOUNTER' && encounterTimeline.isError ? (
          <Text c='red'>Encounter roll history could not be loaded.</Text>
        ) : null}
        {rollView === 'ENCOUNTER' &&
        !encounterTimeline.isPending &&
        !encounterTimeline.data?.entries.some((entry) => entry.roll) ? (
          <Text c='dimmed'>No enemy rolls yet.</Text>
        ) : null}
        {rollView === 'ENCOUNTER'
          ? encounterTimeline.data?.entries.flatMap((entry) => {
              const encounterRoll = entry.roll
              if (!encounterRoll) return []
              return [
                <div className={styles.chatMessageRow} key={entry.id}>
                  <article
                    aria-label={`${encounterRoll.characterLabel ?? 'Enemy'} roll`}
                    className={clsx(styles.chatBubble, chatStyles.rollBubble)}
                  >
                    <div className={styles.chatMessageMeta}>
                      <Text className={styles.chatAuthor} fw={600} size='sm'>
                        {encounterRoll.characterLabel ?? 'Enemy'} · {encounterRoll.source.label}
                      </Text>
                      <Text c='dimmed' size='xs'>
                        {formatChatTime(entry.createdAt)}
                      </Text>
                    </div>
                    <Text>
                      Rolled <strong>{encounterRoll.evidence.total}</strong>
                    </Text>
                    <Text c='dimmed' size='xs'>
                      {encounterRoll.normalizedExpression} · {entry.visibility.toLowerCase()}
                    </Text>
                  </article>
                </div>
              ]
            })
          : null}
        {!showRolls && room === 'DIRECT' && !directUserId ? (
          <Text className={styles.chatEmpty} c='dimmed'>
            Choose a Campaign member to start a direct conversation.
          </Text>
        ) : null}
        {!showRolls && history.isLoading ? <Text c='dimmed'>Loading messages…</Text> : null}
        {!showRolls &&
        !history.isLoading &&
        (room !== 'DIRECT' || directUserId) &&
        entries.length === 0 ? (
          <Text className={styles.chatEmpty} c='dimmed'>
            No messages yet. Start the conversation below.
          </Text>
        ) : null}
        {!showRolls
          ? entries.map((entry) => (
              <div
                className={clsx(
                  styles.chatMessageRow,
                  entry.authorUserId === currentUserId && styles.chatMessageRowOwn
                )}
                key={entry.id}
              >
                <article
                  className={clsx(
                    styles.chatBubble,
                    entry.authorUserId === currentUserId && styles.chatBubbleOwn,
                    entry.kind === 'ROLL' && chatStyles.rollBubble,
                    entry.unsentAt && chatStyles.unsentBubble
                  )}
                >
                  <div className={styles.chatMessageMeta}>
                    <Text className={styles.chatAuthor} fw={600} size='sm'>
                      {entry.characterLabel ?? `@${entry.authorUsername}`}
                    </Text>
                    <Group gap={4} wrap='nowrap'>
                      <Text c='dimmed' size='xs'>
                        {formatChatTime(entry.createdAt)}
                        {entry.editedAt ? ' · edited' : ''}
                      </Text>
                      {entry.authorUserId === currentUserId &&
                      !entry.unsentAt &&
                      entry.kind === 'CHAT' ? (
                        <Menu position='bottom-end' withinPortal>
                          <Menu.Target>
                            <ActionIcon aria-label='Message actions' size='sm' variant='subtle'>
                              <MoreHorizontal aria-hidden='true' size={15} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item onClick={() => entryAction.mutate({ kind: 'EDIT', entry })}>
                              Edit
                            </Menu.Item>
                            <Menu.Item
                              color='red'
                              onClick={() => entryAction.mutate({ kind: 'UNSEND', entry })}
                            >
                              Unsend
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      ) : null}
                    </Group>
                  </div>
                  {entry.unsentAt ? (
                    <Text c='dimmed' fs='italic'>
                      Message unsent
                    </Text>
                  ) : entry.kind === 'ROLL' && entry.roll ? (
                    <Text>
                      Rolled {entry.roll.normalizedExpression}:{' '}
                      <strong>{entry.roll.evidence.total}</strong>
                    </Text>
                  ) : (
                    <Text style={{ whiteSpace: 'pre-wrap' }}>{entry.body}</Text>
                  )}
                </article>
              </div>
            ))
          : null}
      </div>

      {!showRolls && (room !== 'DIRECT' || directUserId) && campaign.status === 'ACTIVE' ? (
        <form className={styles.chatComposer} onSubmit={submitMessage}>
          <Textarea
            autosize
            aria-label={`Message ${conversationLabel}`}
            classNames={{ input: styles.chatComposerInput }}
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
          <div className={styles.chatComposerToolbar}>
            <SegmentedControl
              aria-label='Message voice'
              className={styles.chatVoice}
              data={[
                { label: `@${currentMember?.username ?? 'username'}`, value: 'OOC' },
                ...(assignedCharacter
                  ? [{ label: assignedCharacter.label, value: 'ROLEPLAY' }]
                  : [])
              ]}
              size='xs'
              value={mode}
              onChange={(value) => setMode((value as typeof mode) ?? 'OOC')}
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

function formatChatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value))
}
