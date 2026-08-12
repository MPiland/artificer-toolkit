import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import { campaignCommandFingerprint } from './campaignCommandService.js'

const ids = {
  campaignId: '00000000-0000-4000-8000-000000000001',
  ownerId: '00000000-0000-4000-8000-000000000002',
  memberId: '00000000-0000-4000-8000-000000000003',
  otherMemberId: '00000000-0000-4000-8000-000000000004',
  thirdMemberId: '00000000-0000-4000-8000-000000000005',
  partyId: '00000000-0000-4000-8000-000000000006',
  commandId: '00000000-0000-4000-8000-000000000007',
  priorId: '00000000-0000-4000-8000-000000000008',
  tableAnnouncementId: '00000000-0000-4000-8000-000000000090',
  partyAnnouncementId: '00000000-0000-4000-8000-000000000091',
  insertedId: '00000000-0000-4000-8000-000000000092'
}

const mocks = vi.hoisted(() => ({
  authority: vi.fn(),
  announcements: {
    list: vi.fn(),
    find: vi.fn(),
    findByCommand: vi.fn(),
    insert: vi.fn()
  },
  campaigns: {
    lockCampaign: vi.fn(),
    listActiveMemberships: vi.fn()
  },
  collaboration: {
    listConversationMembers: vi.fn()
  },
  activeMemberSelect: {
    executeTakeFirst: vi.fn()
  },
  CampaignConflictError: class CampaignConflictError extends Error {},
  CampaignAccessError: class CampaignAccessError extends Error {},
  assertActiveCampaignMember: vi.fn(),
  assertCampaignOwner: vi.fn(),
  assertCampaignWritable: vi.fn(),
  enqueueNotification: vi.fn(),
  transaction: {
    selectFrom: vi.fn()
  }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignAnnouncementRepository: () => mocks.announcements,
    createCampaignRepository: () => mocks.campaigns,
    createCampaignCollaborationRepository: () => mocks.collaboration,
    withTransaction: async (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.transaction as unknown as DBLike),
    createCampaignConversationRepository: () => mocks.collaboration
  }
})

vi.mock('./campaignService.js', () => ({
  CampaignConflictError: mocks.CampaignConflictError,
  CampaignAccessError: mocks.CampaignAccessError,
  CampaignNotFoundError: class CampaignNotFoundError extends Error {},
  assertActiveCampaignMember: mocks.assertActiveCampaignMember,
  assertCampaignOwner: mocks.assertCampaignOwner,
  assertCampaignWritable: mocks.assertCampaignWritable,
  resolveCampaignAuthority: mocks.authority
}))

vi.mock('../notifications/notificationService.js', () => ({
  enqueueCampaignAnnouncementNotification: (...args: unknown[]) =>
    mocks.enqueueNotification(...args)
}))

const { listCampaignAnnouncements, getCampaignAnnouncement, createCampaignAnnouncement } =
  await import('./campaignAnnouncementService.js')

function authority(memberId: string) {
  return {
    campaign: { id: ids.campaignId, publicId: ids.campaignId, status: 'ACTIVE' },
    membership: { userId: memberId, role: 'OWNER', status: 'ACTIVE' as const },
    assignedCharacter: null
  }
}

function baseAnnouncement(
  scope: 'TABLE' | 'PARTY',
  partyId: string | null = null,
  announcementId = ids.priorId
) {
  const record = {
    announcementPublicId: announcementId,
    campaignId: ids.campaignId,
    authorUserId: ids.ownerId,
    scope,
    partyId,
    title: `${scope} Announcement ${announcementId}`,
    body: `Body ${announcementId}`,
    createdAt: '2026-08-01T10:00:00.000Z'
  }
  return Object.defineProperty(record, 'id', {
    value: announcementId,
    enumerable: false,
    writable: true
  }) as typeof record & { id: string }
}

function createAnnouncementInput(
  overrides: Partial<{
    campaignId: string
    commandId: string
    scope: 'TABLE' | 'PARTY'
    partyId: string | null
    title: string
    body: string
  }> = {}
) {
  return {
    campaignId: ids.campaignId,
    commandId: ids.commandId,
    scope: 'PARTY' as const,
    partyId: ids.partyId,
    title: 'Party call',
    body: 'Party body',
    ...overrides
  }
}

function existingAnnouncement(inputFingerprint: string) {
  const prior = baseAnnouncement('PARTY', ids.partyId, ids.priorId)
  prior.title = 'Party Announcement prior'
  prior.body = 'Body prior'
  return Object.defineProperty(prior, 'inputFingerprint', {
    value: inputFingerprint,
    enumerable: false
  }) as typeof prior & { inputFingerprint: string }
}

describe('Campaign announcement service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.assertCampaignOwner.mockImplementation(() => {})
    mocks.assertCampaignWritable.mockImplementation(() => {})
    mocks.authority.mockResolvedValue(authority(ids.ownerId))
    mocks.campaigns.lockCampaign.mockResolvedValue({ id: ids.campaignId })
    mocks.campaigns.listActiveMemberships.mockResolvedValue([
      { userId: ids.ownerId },
      { userId: ids.memberId },
      { userId: ids.otherMemberId }
    ])
    mocks.collaboration.listConversationMembers.mockResolvedValue([
      { userId: ids.ownerId },
      { userId: ids.memberId }
    ])
    mocks.announcements.list.mockResolvedValue([])
    mocks.announcements.find.mockResolvedValue(null)
    mocks.announcements.findByCommand.mockResolvedValue(null)
    mocks.announcements.insert.mockResolvedValue(
      baseAnnouncement('PARTY', ids.partyId, ids.insertedId)
    )
    mocks.transaction.selectFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        where: vi.fn(() => ({
          where: vi.fn(() => ({
            where: vi.fn(() => ({
              executeTakeFirst: vi.fn().mockResolvedValue({ id: ids.partyId })
            }))
          }))
        }))
      }))
    }))
    mocks.activeMemberSelect.executeTakeFirst.mockResolvedValue({ id: ids.partyId })
    mocks.enqueueNotification.mockResolvedValue(undefined)
  })

  it('projects persistence-only command fields out of announcement DTOs', async () => {
    mocks.announcements.list.mockResolvedValue([
      {
        ...baseAnnouncement('TABLE', null, ids.tableAnnouncementId),
        id: ids.tableAnnouncementId,
        commandId: ids.commandId,
        inputFingerprint: 'persistence-only'
      }
    ])

    await expect(
      listCampaignAnnouncements({} as DBLike, ids.ownerId, ids.campaignId)
    ).resolves.toEqual([
      expect.objectContaining({
        announcementPublicId: ids.tableAnnouncementId,
        scope: 'TABLE'
      })
    ])
  })

  it('filters party announcements for list/get using conversation membership, not campaign role', async () => {
    const nonMember = [{ userId: ids.otherMemberId }]
    mocks.announcements.list.mockResolvedValue([
      baseAnnouncement('TABLE', null, ids.tableAnnouncementId),
      baseAnnouncement('PARTY', ids.partyId, ids.partyAnnouncementId)
    ])
    mocks.collaboration.listConversationMembers.mockResolvedValue(nonMember)

    await expect(
      listCampaignAnnouncements({} as DBLike, ids.ownerId, ids.campaignId)
    ).resolves.toEqual([
      expect.objectContaining({
        announcementPublicId: ids.tableAnnouncementId,
        scope: 'TABLE'
      })
    ])

    mocks.announcements.find.mockResolvedValue(baseAnnouncement('PARTY', ids.partyId, ids.priorId))
    await expect(
      getCampaignAnnouncement({} as DBLike, ids.ownerId, ids.campaignId, ids.priorId)
    ).rejects.toBeInstanceOf(mocks.CampaignAccessError)
  })

  it('notifies only current party members and excludes the publisher', async () => {
    const input = createAnnouncementInput()
    const inserted = baseAnnouncement('PARTY', ids.partyId, ids.insertedId)
    mocks.announcements.insert.mockResolvedValue(inserted)
    mocks.collaboration.listConversationMembers.mockResolvedValue([
      { userId: ids.ownerId },
      { userId: ids.memberId },
      { userId: ids.thirdMemberId }
    ])
    mocks.campaigns.listActiveMemberships.mockResolvedValue([
      { userId: ids.ownerId },
      { userId: ids.memberId },
      { userId: ids.thirdMemberId },
      { userId: ids.otherMemberId }
    ])

    await createCampaignAnnouncement({} as DBLike, ids.ownerId, input)

    expect(mocks.enqueueNotification).toHaveBeenCalledTimes(2)
    expect(mocks.enqueueNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        announcementPublicId: inserted.id,
        recipientUserId: ids.memberId
      })
    )
    expect(mocks.enqueueNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        announcementPublicId: inserted.id,
        recipientUserId: ids.thirdMemberId
      })
    )
    expect(mocks.enqueueNotification).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipientUserId: ids.ownerId
      })
    )
    expect(mocks.enqueueNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        campaignPublicId: ids.campaignId,
        scope: 'PARTY'
      })
    )
  })

  it('returns prior announcement and skips notification when commandId+input is identical', async () => {
    const commandInput = createAnnouncementInput()
    const sameFingerprint = campaignCommandFingerprint(commandInput)
    const prior = existingAnnouncement(sameFingerprint)
    mocks.announcements.findByCommand.mockResolvedValue(prior)

    await expect(
      createCampaignAnnouncement({} as DBLike, ids.ownerId, commandInput)
    ).resolves.toEqual({
      announcementPublicId: ids.priorId,
      campaignId: ids.campaignId,
      authorUserId: ids.ownerId,
      scope: 'PARTY',
      partyId: ids.partyId,
      title: prior.title,
      body: prior.body,
      createdAt: prior.createdAt
    })

    expect(mocks.announcements.findByCommand).toHaveBeenCalledWith(ids.campaignId, ids.commandId)
    expect(mocks.announcements.insert).not.toHaveBeenCalled()
    expect(mocks.enqueueNotification).not.toHaveBeenCalled()
  })

  it('rejects repeated commandId when command input changes', async () => {
    const firstInput = createAnnouncementInput()
    const secondInput = createAnnouncementInput({ body: 'Different body' })
    mocks.announcements.findByCommand.mockResolvedValue(existingAnnouncement('fixed-fingerprint'))

    await expect(
      createCampaignAnnouncement({} as DBLike, ids.ownerId, firstInput)
    ).rejects.toBeInstanceOf(mocks.CampaignConflictError)
    expect(mocks.announcements.insert).not.toHaveBeenCalled()
    expect(mocks.campaigns.lockCampaign).toHaveBeenCalled()
  })
})
