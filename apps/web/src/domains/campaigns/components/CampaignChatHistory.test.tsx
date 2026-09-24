import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'

import { CampaignChatHistory } from './CampaignChatHistory'

const entry: CampaignChatEntryDto = {
  id: '1df2d096-9408-4792-9b26-5c5d8b5f83f1',
  campaignId: 'af7062db-56d4-44f7-8e4c-45cbd917d3f1',
  conversationId: 'ff3b7ca3-f551-4e00-9bf8-afd37b8050d1',
  room: 'TABLE',
  kind: 'CHAT',
  mode: 'ROLEPLAY',
  body: 'The history remains.',
  roll: null,
  authorUserId: '48c98265-8507-4c77-bf99-1585a4a46274',
  authorUsername: 'Deleted user',
  characterId: '5c6f2647-8a8e-4e8e-8a9e-19f9554bf79c',
  characterLabel: 'Retained Ranger',
  editedAt: null,
  unsentAt: null,
  createdAt: '2026-09-18T12:00:00.000Z'
}

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
          isEncounterTimelineError={false}
          isEncounterTimelinePending={false}
          isHistoryLoading={false}
          isLoadingOlderMessages={false}
          isPrivateRollsError={false}
          isPrivateRollsPending={false}
          privateRolls={undefined}
          rollView={null}
          room='TABLE'
          onEntryAction={vi.fn()}
          onLoadOlderMessages={vi.fn()}
        />
      </MantineProvider>
    )

    expect(screen.getByText('Deleted user')).toBeInTheDocument()
    expect(screen.queryByText('Retained Ranger')).not.toBeInTheDocument()
  })
})
