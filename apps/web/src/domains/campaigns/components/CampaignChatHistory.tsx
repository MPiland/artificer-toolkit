import { ActionIcon, Button, Group, Menu, Text } from '@mantine/core'
import { MoreHorizontal } from 'lucide-react'
import type { RefObject } from 'react'
import clsx from 'clsx'
import type { EncounterTimelineDto } from '@artificer-toolkit/schema/api/encounters'
import { deletedCampaignAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollHistoryEntryDto } from '@artificer-toolkit/schema/api/rolls'
import { CharacterSheetRollReveal } from '#app/domains/characters/sheet/dice/CharacterSheetRollReveal'
import { blindRollLabel, formatRollEvidence } from '#app/domains/characters/sheet/dice/dice.utils'
import * as chatStyles from './CampaignChat.css'
import type { CampaignChatRoom, CampaignRollView } from './campaignChat.types'

export function CampaignChatHistory({
  chatLog,
  conversationLabel,
  currentUserId,
  directUserId,
  encounterEntries,
  entries,
  hasNextPage,
  isEncounterTimelineError,
  isEncounterTimelinePending,
  isHistoryLoading,
  isLoadingOlderMessages,
  isPrivateRollsError,
  isPrivateRollsPending,
  privateRolls,
  rollView,
  room,
  onEntryAction,
  onLoadOlderMessages
}: {
  chatLog: RefObject<HTMLDivElement | null>
  conversationLabel: string
  currentUserId: string
  directUserId: string | undefined
  encounterEntries:
    | Pick<EncounterTimelineDto['entries'][number], 'id' | 'visibility' | 'roll' | 'createdAt'>[]
    | undefined
  entries: CampaignChatEntryDto[]
  hasNextPage: boolean
  isEncounterTimelineError: boolean
  isEncounterTimelinePending: boolean
  isHistoryLoading: boolean
  isLoadingOlderMessages: boolean
  isPrivateRollsError: boolean
  isPrivateRollsPending: boolean
  privateRolls: RollHistoryEntryDto[] | undefined
  rollView: CampaignRollView
  room: CampaignChatRoom
  onEntryAction: (action: { kind: 'EDIT' | 'UNSEND'; entry: CampaignChatEntryDto }) => void
  onLoadOlderMessages: () => void
}) {
  const showRolls = rollView !== null

  return (
    <div
      className={chatStyles.chatLog}
      aria-label={`${conversationLabel} history`}
      aria-live='polite'
      role='log'
      ref={chatLog}
    >
      {!showRolls && hasNextPage ? (
        <Button
          className={chatStyles.historyControl}
          loading={isLoadingOlderMessages}
          size='compact-sm'
          variant='subtle'
          onClick={onLoadOlderMessages}
        >
          Load older messages
        </Button>
      ) : null}
      {rollView === 'MINE' && isPrivateRollsPending ? <Text c='dimmed'>Loading rolls…</Text> : null}
      {rollView === 'MINE' && isPrivateRollsError ? (
        <Text c='red'>Roll history could not be loaded.</Text>
      ) : null}
      {rollView === 'MINE' && !isPrivateRollsPending && !privateRolls?.length ? (
        <Text c='dimmed'>No private rolls yet.</Text>
      ) : null}
      {rollView === 'MINE'
        ? privateRolls?.map((privateRoll) => (
            <div
              className={clsx(chatStyles.chatMessageRow, chatStyles.chatMessageRowOwn)}
              key={privateRoll.id}
            >
              <article
                aria-label='Private roll'
                className={clsx(
                  chatStyles.chatBubble,
                  chatStyles.chatBubbleOwn,
                  chatStyles.rollBubble
                )}
              >
                <div className={chatStyles.chatMessageMeta}>
                  <Text className={chatStyles.chatAuthor} fw={600} size='sm'>
                    {privateRoll.source.label}
                  </Text>
                  <Text c='dimmed' size='xs'>
                    {formatChatTime(privateRoll.createdAt)}
                  </Text>
                </div>
                {privateRoll.evidence === null ? (
                  <Text>{blindRollLabel}</Text>
                ) : (
                  <>
                    <Text>
                      Rolled <strong>{privateRoll.evidence.total}</strong>
                    </Text>
                    <Text c='dimmed' size='xs'>
                      {formatRollEvidence(privateRoll.evidence)}
                    </Text>
                  </>
                )}
                <CharacterSheetRollReveal roll={privateRoll} />
              </article>
            </div>
          ))
        : null}
      {rollView === 'ENCOUNTER' && isEncounterTimelinePending ? (
        <Text c='dimmed'>Loading enemy rolls…</Text>
      ) : null}
      {rollView === 'ENCOUNTER' && isEncounterTimelineError ? (
        <Text c='red'>Encounter roll history could not be loaded.</Text>
      ) : null}
      {rollView === 'ENCOUNTER' &&
      !isEncounterTimelinePending &&
      !encounterEntries?.some((entry) => entry.roll) ? (
        <Text c='dimmed'>No enemy rolls yet.</Text>
      ) : null}
      {rollView === 'ENCOUNTER'
        ? encounterEntries?.flatMap((entry) => {
            const encounterRoll = entry.roll
            if (!encounterRoll) return []
            return [
              <div className={chatStyles.chatMessageRow} key={entry.id}>
                <article
                  aria-label={`${encounterRoll.characterLabel ?? 'Enemy'} roll`}
                  className={clsx(chatStyles.chatBubble, chatStyles.rollBubble)}
                >
                  <div className={chatStyles.chatMessageMeta}>
                    <Text className={chatStyles.chatAuthor} fw={600} size='sm'>
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
        <Text className={chatStyles.chatEmpty} c='dimmed'>
          Choose a Campaign member to start a direct conversation.
        </Text>
      ) : null}
      {!showRolls && isHistoryLoading ? <Text c='dimmed'>Loading messages…</Text> : null}
      {!showRolls &&
      !isHistoryLoading &&
      (room !== 'DIRECT' || directUserId) &&
      entries.length === 0 ? (
        <Text className={chatStyles.chatEmpty} c='dimmed'>
          No messages yet. Start the conversation below.
        </Text>
      ) : null}
      {!showRolls
        ? entries.map((entry) => (
            <div
              className={clsx(
                chatStyles.chatMessageRow,
                entry.authorUserId === currentUserId && chatStyles.chatMessageRowOwn
              )}
              key={entry.id}
            >
              <article
                className={clsx(
                  chatStyles.chatBubble,
                  entry.authorUserId === currentUserId && chatStyles.chatBubbleOwn,
                  entry.kind === 'ROLL' && chatStyles.rollBubble,
                  entry.unsentAt && chatStyles.unsentBubble
                )}
              >
                <div className={chatStyles.chatMessageMeta}>
                  <Text className={chatStyles.chatAuthor} fw={600} size='sm'>
                    {entry.authorUsername === deletedCampaignAuthorLabel
                      ? deletedCampaignAuthorLabel
                      : (entry.characterLabel ?? `@${entry.authorUsername}`)}
                  </Text>
                  <Group gap={4} wrap='nowrap'>
                    <Text c='dimmed' size='xs'>
                      {formatChatTime(entry.createdAt)}
                      {entry.editedAt ? ' · edited' : ''}
                      {entry.revealedByGm ? ' · Revealed by GM' : ''}
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
                          <Menu.Item onClick={() => onEntryAction({ kind: 'EDIT', entry })}>
                            Edit
                          </Menu.Item>
                          <Menu.Item
                            color='red'
                            onClick={() => onEntryAction({ kind: 'UNSEND', entry })}
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
