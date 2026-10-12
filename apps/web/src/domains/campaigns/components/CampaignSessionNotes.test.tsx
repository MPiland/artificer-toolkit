import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { deletedCampaignAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import { campaignSessionNoteSectionDtoSchema } from '@artificer-toolkit/schema/api/campaignSessions'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SessionSectionEditor } from './CampaignSessionNotes'

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({ mutation: vi.fn() })
}))

vi.mock('#app/ui/primitives/RichTextEditor/RichTextEditor', () => ({
  default: () => null
}))

const section = campaignSessionNoteSectionDtoSchema.parse({
  id: '11111111-1111-4111-8111-111111111111',
  campaignId: '22222222-2222-4222-8222-222222222222',
  sessionId: '33333333-3333-4333-8333-333333333333',
  authorUserId: '44444444-4444-4444-8444-444444444444',
  authorLabel: 'Mira',
  title: 'Player recap',
  content: '<p>Player recap</p>',
  visibility: 'SHARED',
  kind: 'NOTE',
  sortOrder: 0,
  version: 0,
  createdAt: '2026-09-25T12:00:00.000Z',
  updatedAt: '2026-09-25T12:00:00.000Z'
})

describe('SessionSectionEditor', () => {
  it('marks a shared note and names its author to readers', () => {
    renderWithAppProviders(
      <SessionSectionEditor
        campaignId={section.campaignId}
        deletable
        editable={false}
        isGm={false}
        section={section}
      />
    )
    expect(screen.getByText('Shared · by Mira')).toBeVisible()
  })

  it('shows the deleted-user label the server resolved', () => {
    renderWithAppProviders(
      <SessionSectionEditor
        campaignId={section.campaignId}
        deletable={false}
        editable={false}
        isGm={false}
        section={{ ...section, authorLabel: deletedCampaignAuthorLabel }}
      />
    )
    expect(screen.getByText(`Shared · by ${deletedCampaignAuthorLabel}`)).toBeVisible()
  })

  it('shows a private note to the GM with its author, and to its author as an editable visibility choice', () => {
    const privateSection = { ...section, visibility: 'PRIVATE' } as const
    const { unmount } = renderWithAppProviders(
      <SessionSectionEditor
        campaignId={section.campaignId}
        deletable
        editable={false}
        isGm
        section={privateSection}
      />
    )
    expect(screen.getByText('Private · by Mira')).toBeVisible()
    unmount()
    renderWithAppProviders(
      <SessionSectionEditor
        campaignId={section.campaignId}
        deletable
        editable
        isGm={false}
        section={privateSection}
      />
    )
    expect(screen.getByRole('combobox', { name: 'Visibility' })).toHaveValue('Private')
  })

  it('lets only an editable author change a note’s visibility', () => {
    const { unmount } = renderWithAppProviders(
      <SessionSectionEditor
        campaignId={section.campaignId}
        deletable
        editable
        isGm={false}
        section={section}
      />
    )
    expect(screen.getByRole('combobox', { name: 'Visibility' })).toBeVisible()
    unmount()
    renderWithAppProviders(
      <SessionSectionEditor
        campaignId={section.campaignId}
        deletable
        editable={false}
        isGm
        section={section}
      />
    )
    expect(screen.queryByRole('combobox', { name: 'Visibility' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  it('keeps GM-only sections unlabelled', () => {
    renderWithAppProviders(
      <SessionSectionEditor
        campaignId={section.campaignId}
        deletable
        editable
        isGm
        section={{ ...section, visibility: 'PRIVATE', kind: 'SECRET' }}
      />
    )
    expect(screen.queryByText(/Private|Shared/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Visibility')).not.toBeInTheDocument()
  })
})
