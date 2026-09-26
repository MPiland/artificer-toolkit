import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CampaignAttachmentDto } from '@artificer-toolkit/schema/api/campaignAttachments'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignFileList } from './CampaignFileList'
import { CampaignFileUploader } from './CampaignFileUploader'

const mocks = vi.hoisted(() => ({
  attachments: {
    results: [] as CampaignAttachmentDto[],
    status: 'Exhausted' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  notebook: {
    results: [] as Array<{ id: string; title: string }>,
    status: 'Exhausted' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  sessions: {
    results: [] as Array<{ id: string; title: string | null; sessionNumber: number }>,
    status: 'Exhausted' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  createUpload: vi.fn(),
  finalize: vi.fn(),
  createAttachment: vi.fn(),
  getDelivery: vi.fn(),
  removeAttachment: vi.fn()
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useAction: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === 'media/fileActions:finalize'
      ? mocks.finalize
      : mocks.getDelivery,
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference)
    if (name === 'media/fileAssets:createUpload') return mocks.createUpload
    if (name === 'campaigns/attachments:create') return mocks.createAttachment
    return mocks.removeAttachment
  },
  usePaginatedQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference)
    if (name === 'campaigns/notebooks:list') return mocks.notebook
    if (name === 'campaigns/sessions:list') return mocks.sessions
    return mocks.attachments
  }
}))

const campaign = {
  id: '11111111-1111-4111-8111-111111111111',
  publicId: '4fzz7',
  name: 'The Ashen Road',
  description: null,
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  toneDetails: null,
  contentMaturity: 'STANDARD',
  gameSystemId: '00000000-0000-4000-8000-000000000001',
  primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
  additionalRulesCatalogueIds: [],
  status: 'ACTIVE',
  role: 'OWNER',
  version: 1,
  memberCount: 1,
  playerCount: 0,
  createdAt: '2026-08-06T12:00:00.000Z',
  updatedAt: '2026-08-06T12:00:00.000Z',
  attunementSlotOverride: null,
  assignedCharacter: null,
  memberships: [],
  capabilities: {
    edit: true,
    archive: true,
    delete: true,
    invite: true,
    manageMembers: true,
    manageCharacters: true,
    assignOwnCharacter: false,
    manageSharedContent: true,
    shareOwnedContent: true,
    managePartyInventory: true,
    transferOwnInventory: true,
    manageNotes: true,
    contributeSessionNotes: true,
    readTableChat: true,
    readPartyChat: true
  }
} satisfies CampaignDetailDto

describe('CampaignFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.attachments.results = []
    mocks.attachments.status = 'Exhausted'
    mocks.notebook.results = []
    mocks.notebook.status = 'Exhausted'
    mocks.sessions.results = []
    mocks.sessions.status = 'Exhausted'
  })

  it('uploads and attaches a file through native Convex functions', async () => {
    const user = userEvent.setup()
    const file = new File(['map'], 'dungeon.png', { type: 'image/png' })
    mocks.createUpload.mockResolvedValue({
      assetId: '22222222-2222-4222-8222-222222222222',
      method: 'PUT',
      url: 'https://example.com/upload',
      expiresAt: '2026-08-06T12:05:00.000Z'
    })
    mocks.finalize.mockResolvedValue({
      assetId: '22222222-2222-4222-8222-222222222222',
      status: 'READY',
      preview: null
    })
    mocks.createAttachment.mockResolvedValue({ id: '33333333-3333-4333-8333-333333333333' })
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))

    renderWithAppProviders(<CampaignFileUploader campaignId={campaign.id} />)
    await user.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, file)
    await user.click(screen.getByRole('button', { name: 'Upload file' }))

    await waitFor(() => expect(mocks.createAttachment).toHaveBeenCalledOnce())
    expect(mocks.createUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: 'CAMPAIGN_FILE',
        target: { type: 'CAMPAIGN_FILE', campaignId: campaign.id },
        originalFileName: 'dungeon.png',
        declaredMimeType: 'image/png',
        declaredBytes: file.size
      })
    )
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/upload', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: file
    })
    expect(mocks.finalize).toHaveBeenCalledWith({
      assetId: '22222222-2222-4222-8222-222222222222'
    })
    expect(mocks.createAttachment).toHaveBeenCalledWith({
      campaignId: campaign.id,
      assetId: '22222222-2222-4222-8222-222222222222',
      displayName: 'dungeon.png',
      description: null,
      sessionId: null,
      noteSectionId: null
    })
  })

  it('uses the native attachment list, delivery, removal, and pagination', async () => {
    const user = userEvent.setup()
    mocks.attachments.results = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        assetId: '22222222-2222-4222-8222-222222222222',
        campaignId: campaign.id,
        uploaderUserId: '44444444-4444-4444-8444-444444444444',
        uploaderLabel: 'Mira',
        profile: 'CAMPAIGN_HANDOUT_MAP',
        displayName: 'Dungeon map',
        description: 'Lower level',
        sessionId: '55555555-5555-4555-8555-555555555555',
        noteSectionId: null,
        createdAt: '2026-08-06T12:00:00.000Z'
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        assetId: '77777777-7777-4777-8777-777777777777',
        campaignId: campaign.id,
        uploaderUserId: '44444444-4444-4444-8444-444444444444',
        uploaderLabel: 'Mira',
        profile: 'CAMPAIGN_FILE',
        displayName: 'Other session',
        description: null,
        sessionId: '88888888-8888-4888-8888-888888888888',
        noteSectionId: null,
        createdAt: '2026-08-06T12:00:00.000Z'
      }
    ]
    mocks.attachments.status = 'CanLoadMore'
    mocks.getDelivery.mockResolvedValue({
      url: 'https://example.com/download',
      expiresAt: '2026-08-06T12:05:00.000Z',
      fileName: 'dungeon.png',
      mimeType: 'image/png'
    })
    mocks.removeAttachment.mockResolvedValue({ ok: true })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderWithAppProviders(
      <CampaignFileList
        campaign={campaign}
        currentUserId='99999999-9999-4999-8999-999999999999'
        sessionId='55555555-5555-4555-8555-555555555555'
      />
    )

    expect(screen.getByText('Dungeon map')).toBeVisible()
    expect(screen.getByText('Uploaded by Mira')).toBeVisible()
    expect(screen.queryByText('Other session')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Load more files' }))
    expect(mocks.attachments.loadMore).toHaveBeenCalledWith(48)

    await user.click(screen.getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(mocks.getDelivery).toHaveBeenCalledWith({
      campaignId: campaign.id,
      attachmentId: '33333333-3333-4333-8333-333333333333'
    })

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() =>
      expect(mocks.removeAttachment).toHaveBeenCalledWith({
        campaignId: campaign.id,
        attachmentId: '33333333-3333-4333-8333-333333333333'
      })
    )
  })

  it('loads a later notebook page for the file note picker', async () => {
    const user = userEvent.setup()
    mocks.notebook.results = Array.from({ length: 8 }, (_, index) => ({
      id: `11111111-1111-4111-8111-11111111111${index}`,
      title: `Note ${index + 1}`
    }))
    mocks.notebook.status = 'CanLoadMore'

    renderWithAppProviders(<CampaignFileUploader campaignId={campaign.id} />)

    await user.click(screen.getByRole('button', { name: 'Load more notes' }))
    expect(mocks.notebook.loadMore).toHaveBeenCalledWith(8)
  })
})
