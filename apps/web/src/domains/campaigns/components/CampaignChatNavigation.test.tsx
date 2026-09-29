import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { campaignChatUnreadCountLimit } from '@artificer-toolkit/schema/api/campaignCommunication'

import { CampaignChatNavigation } from './CampaignChatNavigation'

it('shows exact unread counts below the cap and "at least" at the cap', () => {
  render(
    <MantineProvider>
      <CampaignChatNavigation
        canReadPartyChat
        directMembers={[]}
        directUnread={0}
        hasActiveEncounter={false}
        room='TABLE'
        roomUnread={{ TABLE: campaignChatUnreadCountLimit, PARTY: 3 }}
        rollView={null}
        onSelectDirect={vi.fn()}
        onSelectRollView={vi.fn()}
        onSelectRoom={vi.fn()}
      />
    </MantineProvider>
  )
  expect(screen.getByLabelText(`${campaignChatUnreadCountLimit}+ unread`)).toHaveTextContent(
    `${campaignChatUnreadCountLimit}+`
  )
  expect(screen.getByLabelText('3 unread')).toHaveTextContent('3')
})
