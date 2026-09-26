import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { deletedCampaignAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { CampaignSessionNoteSectionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SessionSectionEditor } from './CampaignSessionNotes'

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({ mutation: vi.fn() })
}))

vi.mock('#app/ui/primitives/RichTextEditor/RichTextEditor', () => ({
  default: () => null
}))

const section = {
  id: '11111111-1111-4111-8111-111111111111',
  campaignId: '22222222-2222-4222-8222-222222222222',
  sessionId: '33333333-3333-4333-8333-333333333333',
  authorUserId: '44444444-4444-4444-8444-444444444444',
  authorLabel: 'Mira',
  title: 'Player recap',
  content: '<p>Player recap</p>',
  visibility: 'SHARED',
  kind: 'SHARED_NOTE',
  sortOrder: 0,
  version: 0,
  createdAt: '2026-09-25T12:00:00.000Z',
  updatedAt: '2026-09-25T12:00:00.000Z'
} satisfies CampaignSessionNoteSectionDto

describe('SessionSectionEditor', () => {
  it('names the author of a shared note', () => {
    renderWithAppProviders(
      <SessionSectionEditor campaignId={section.campaignId} deletable editable section={section} />
    )
    expect(screen.getByText('Note by Mira')).toBeVisible()
  })

  it('shows the deleted-user label the server resolved', () => {
    renderWithAppProviders(
      <SessionSectionEditor
        campaignId={section.campaignId}
        deletable={false}
        editable={false}
        section={{ ...section, authorLabel: deletedCampaignAuthorLabel }}
      />
    )
    expect(screen.getByText(`Note by ${deletedCampaignAuthorLabel}`)).toBeVisible()
  })

  it('keeps GM-private sections unattributed', () => {
    renderWithAppProviders(
      <SessionSectionEditor
        campaignId={section.campaignId}
        deletable
        editable
        section={{ ...section, visibility: 'GM_PRIVATE', kind: 'SECRET' }}
      />
    )
    expect(screen.queryByText(/Note by/)).not.toBeInTheDocument()
  })
})
