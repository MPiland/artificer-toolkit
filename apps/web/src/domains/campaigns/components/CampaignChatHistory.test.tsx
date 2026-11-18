import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  campaignChatEntryDtoSchema,
  ruleCheckAuthorLabel
} from '@artificer-toolkit/schema/api/campaignCommunication'

import { cancelledAdvantageRoll } from '#app/components/dice/adjustedRoll.fixtures'
import { CampaignChatHistory } from './CampaignChatHistory'

const entry = campaignChatEntryDtoSchema.parse({
  id: '1df2d096-9408-4792-9b26-5c5d8b5f83f1',
  campaignId: 'af7062db-56d4-44f7-8e4c-45cbd917d3f1',
  conversationId: 'ff3b7ca3-f551-4e00-9bf8-afd37b8050d1',
  room: 'TABLE',
  kind: 'CHAT',
  mode: 'ROLEPLAY',
  body: 'The history remains.',
  rolls: [],
  authorUserId: '48c98265-8507-4c77-bf99-1585a4a46274',
  authorUsername: 'Deleted user',
  characterId: '5c6f2647-8a8e-4e8e-8a9e-19f9554bf79c',
  characterLabel: 'Retained Ranger',
  editedAt: null,
  unsentAt: null,
  createdAt: '2026-09-18T12:00:00.000Z'
})

describe('CampaignChatHistory', () => {
  it('shows a deleted author even when retained roleplay identity is available', () => {
    render(
      <MantineProvider>
        <CampaignChatHistory
          chatLog={{ current: null }}
          conversationLabel='Table'
          currentUserId='different-user'
          directUserId={undefined}
          encounterEntries={undefined}
          entries={[entry]}
          hasNextPage={false}
          isHistoryLoading={false}
          isLoadingOlderMessages={false}
          isPrivateRollsError={false}
          isPrivateRollsPending={false}
          privateRolls={undefined}
          rollView={null}
          room='TABLE'
          onEntryAction={vi.fn()}
          onLoadOlderMessages={vi.fn()}
          onRevealRoll={vi.fn()}
        />
      </MantineProvider>
    )

    expect(screen.getByText('Deleted user')).toBeInTheDocument()
    expect(screen.queryByText('Retained Ranger')).not.toBeInTheDocument()
  })

  it('shows a rules-settled Concentration check with its trigger, dice and outcome', () => {
    const roll = campaignChatEntryDtoSchema.parse({
      ...entry,
      kind: 'ROLL',
      mode: null,
      body: null,
      authorUsername: ruleCheckAuthorLabel,
      characterId: null,
      characterLabel: 'Mira',
      rolls: [
        {
          revealedByGm: false,
          roll: {
            id: '0c0b0a09-0807-4605-8403-020100fffefd',
            normalizedExpression: '1d20+3',
            evidence: {
              terms: [{ count: 1, die: 20, rolls: [6], subtotal: 6 }],
              modifier: 3,
              mode: 'NORMAL',
              keep: 'FIRST',
              subtotal: 9,
              transform: { kind: 'NONE' },
              total: 9
            },
            characterId: null,
            characterLabel: 'Mira',
            source: { kind: 'SAVING_THROW', label: 'Concentration' },
            ruleset: { systemId: 'system', code: 'dnd5e', version: '2014' },
            createdAt: '2026-09-18T12:00:00.000Z',
            ruleCheck: {
              kind: 'CONCENTRATION',
              actorId: '5c6f2647-8a8e-4e8e-8a9e-19f9554bf79c',
              actorLabel: 'Mira',
              damage: { amount: 12, typeLabel: 'Fire' },
              sourceLabel: 'Fire Bolt',
              dc: 10,
              faces: [6],
              modifier: 3,
              total: 9,
              outcome: 'LOST'
            }
          }
        }
      ]
    })
    render(
      <MantineProvider>
        <CampaignChatHistory
          chatLog={{ current: null }}
          conversationLabel='Table'
          currentUserId='different-user'
          directUserId={undefined}
          encounterEntries={undefined}
          entries={[roll]}
          hasNextPage={false}
          isHistoryLoading={false}
          isLoadingOlderMessages={false}
          isPrivateRollsError={false}
          isPrivateRollsPending={false}
          privateRolls={undefined}
          rollView={null}
          room='TABLE'
          onEntryAction={vi.fn()}
          onLoadOlderMessages={vi.fn()}
          onRevealRoll={vi.fn()}
        />
      </MantineProvider>
    )

    expect(
      screen.getByText('Concentration check: took 12 fire from Fire Bolt (DC 10)')
    ).toBeInTheDocument()
    expect(screen.getByText('Concentration lost')).toBeInTheDocument()
    expect(screen.getByText(/vs DC 10/)).toBeInTheDocument()
  })

  it('shows the rolled d20 of an automatically failed save with the condition that failed it', () => {
    const roll = campaignChatEntryDtoSchema.parse({
      ...entry,
      kind: 'ROLL',
      mode: null,
      body: null,
      authorUsername: ruleCheckAuthorLabel,
      characterId: null,
      characterLabel: 'Mira',
      rolls: [
        {
          revealedByGm: false,
          roll: {
            id: '0c0b0a09-0807-4605-8403-020100fffefe',
            normalizedExpression: '1d20+2',
            evidence: {
              terms: [{ count: 1, die: 20, rolls: [20], subtotal: 20 }],
              modifier: 2,
              mode: 'NORMAL',
              keep: 'FIRST',
              subtotal: 22,
              transform: { kind: 'NONE' },
              total: 22
            },
            characterId: null,
            characterLabel: 'Mira',
            source: { kind: 'SAVING_THROW', label: 'Acid Spray save' },
            ruleset: { systemId: 'system', code: 'dnd5e', version: '2014' },
            createdAt: '2026-09-18T12:00:00.000Z',
            ruleCheck: { kind: 'SAVE_AUTO_FAIL', labels: ['Paralyzed'] }
          }
        }
      ]
    })
    render(
      <MantineProvider>
        <CampaignChatHistory
          chatLog={{ current: null }}
          conversationLabel='Table'
          currentUserId='different-user'
          directUserId={undefined}
          encounterEntries={undefined}
          entries={[roll]}
          hasNextPage={false}
          isHistoryLoading={false}
          isLoadingOlderMessages={false}
          isPrivateRollsError={false}
          isPrivateRollsPending={false}
          privateRolls={undefined}
          rollView={null}
          room='TABLE'
          onEntryAction={vi.fn()}
          onLoadOlderMessages={vi.fn()}
          onRevealRoll={vi.fn()}
        />
      </MantineProvider>
    )

    expect(screen.getByText('Fails automatically: Paralyzed')).toBeInTheDocument()
  })

  it('shows every die of a mode-adjusted d20 with the cancelled die and the caption', () => {
    const roll = campaignChatEntryDtoSchema.parse({
      ...entry,
      kind: 'ROLL',
      mode: null,
      body: null,
      rolls: [{ revealedByGm: false, roll: cancelledAdvantageRoll() }]
    })
    render(
      <MantineProvider>
        <CampaignChatHistory
          chatLog={{ current: null }}
          conversationLabel='Table'
          currentUserId='different-user'
          directUserId={undefined}
          encounterEntries={undefined}
          entries={[roll]}
          hasNextPage={false}
          isHistoryLoading={false}
          isLoadingOlderMessages={false}
          isPrivateRollsError={false}
          isPrivateRollsPending={false}
          privateRolls={undefined}
          rollView={null}
          room='TABLE'
          onEntryAction={vi.fn()}
          onLoadOlderMessages={vi.fn()}
          onRevealRoll={vi.fn()}
        />
      </MantineProvider>
    )

    expect(screen.getByText(/7 kept, 16 cancelled/)).toBeInTheDocument()
    expect(screen.getByText(/Advantage cancelled: the target can sense you/)).toBeInTheDocument()
  })

  it('renders every roll of a multi-roll entry and marks only the revealed one', () => {
    const rollOf = (id: string, expression: string, total: number) => ({
      id,
      normalizedExpression: expression,
      evidence: {
        terms: [{ count: 1, die: 20, rolls: [total], subtotal: total }],
        modifier: 0,
        mode: 'NORMAL' as const,
        keep: 'FIRST' as const,
        subtotal: total,
        transform: { kind: 'NONE' as const },
        total
      },
      characterId: null,
      characterLabel: null,
      source: { kind: 'MANUAL' as const, label: 'Manual' },
      ruleset: { systemId: 'system', code: 'dnd5e', version: '2014' },
      createdAt: '2026-09-18T12:00:00.000Z'
    })
    const multi = campaignChatEntryDtoSchema.parse({
      ...entry,
      kind: 'ROLL',
      mode: null,
      body: null,
      rolls: [
        { revealedByGm: false, roll: rollOf('0c0b0a09-0807-4605-8403-020100fffe01', '1d20', 11) },
        { revealedByGm: true, roll: rollOf('0c0b0a09-0807-4605-8403-020100fffe02', '2d20', 23) }
      ]
    })
    render(
      <MantineProvider>
        <CampaignChatHistory
          chatLog={{ current: null }}
          conversationLabel='Table'
          currentUserId='different-user'
          directUserId={undefined}
          encounterEntries={undefined}
          entries={[multi]}
          hasNextPage={false}
          isHistoryLoading={false}
          isLoadingOlderMessages={false}
          isPrivateRollsError={false}
          isPrivateRollsPending={false}
          privateRolls={undefined}
          rollView={null}
          room='TABLE'
          onEntryAction={vi.fn()}
          onLoadOlderMessages={vi.fn()}
          onRevealRoll={vi.fn()}
        />
      </MantineProvider>
    )

    expect(screen.getByText(/Rolled 1d20:/)).toBeInTheDocument()
    expect(screen.getByText(/Rolled 2d20:/)).toBeInTheDocument()
    expect(screen.getAllByText('Revealed by GM')).toHaveLength(1)
  })

  it('shows a ROLL_NOTICE as a notice with no result, naming the creature when present', () => {
    const notice = campaignChatEntryDtoSchema.parse({
      ...entry,
      kind: 'ROLL_NOTICE',
      mode: null,
      body: null,
      authorUsername: 'gm',
      characterId: null,
      characterLabel: null
    })
    render(
      <MantineProvider>
        <CampaignChatHistory
          chatLog={{ current: null }}
          conversationLabel='Table'
          currentUserId='different-user'
          directUserId={undefined}
          encounterEntries={undefined}
          entries={[
            notice,
            { ...notice, id: '2df2d096-9408-4792-9b26-5c5d8b5f83f1', characterLabel: 'Goblin' }
          ]}
          hasNextPage={false}
          isHistoryLoading={false}
          isLoadingOlderMessages={false}
          isPrivateRollsError={false}
          isPrivateRollsPending={false}
          privateRolls={undefined}
          rollView={null}
          room='TABLE'
          onEntryAction={vi.fn()}
          onLoadOlderMessages={vi.fn()}
          onRevealRoll={vi.fn()}
        />
      </MantineProvider>
    )

    expect(screen.getByText('The GM made a roll')).toBeInTheDocument()
    expect(screen.getByText('Goblin made a roll')).toBeInTheDocument()
    expect(screen.queryByText(/Rolled/)).not.toBeInTheDocument()
  })
})
