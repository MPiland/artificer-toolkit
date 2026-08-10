import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  owner: '00000000-0000-4000-8000-000000000002',
  player: '00000000-0000-4000-8000-000000000003',
  character: '00000000-0000-4000-8000-000000000004',
  adjustment: '00000000-0000-4000-8000-000000000005',
  event: '00000000-0000-4000-8000-000000000006'
}

const mocks = vi.hoisted(() => ({
  authority: vi.fn(),
  campaign: { lockCampaign: vi.fn(), findAssignmentByCharacter: vi.fn() },
  adjustments: {
    listAdjustments: vi.fn(),
    saveAdjustment: vi.fn(),
    deleteAdjustmentById: vi.fn(),
    insertCampaignEvent: vi.fn(),
    listVisibleEvents: vi.fn()
  },
  character: { findAuthoredById: vi.fn(), upsertAuthored: vi.fn() },
  resolveBuilder: vi.fn(),
  validateTarget: vi.fn(),
  validateCondition: vi.fn(),
  broadcast: vi.fn(),
  transaction: { transaction: true }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignRepository: () => mocks.campaign,
    createCampaignAdjustmentsRepository: () => mocks.adjustments,
    createCharacterRepository: () => mocks.character,
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.transaction as unknown as DBLike)
  }
})

vi.mock('./campaignService.js', () => ({
  CampaignAccessError: class CampaignAccessError extends Error {},
  CampaignConflictError: class CampaignConflictError extends Error {},
  CampaignNotFoundError: class CampaignNotFoundError extends Error {},
  CampaignValidationError: class CampaignValidationError extends Error {},
  assertActiveCampaignMember: vi.fn(),
  assertCampaignOwner: vi.fn(),
  assertCampaignWritable: vi.fn(),
  resolveCampaignAuthority: mocks.authority
}))
vi.mock('../character/builderService.js', () => ({ resolveCharacterBuilder: mocks.resolveBuilder }))
vi.mock('../character/sheetCommandValidation.js', () => ({
  validateSheetAdjustmentTarget: mocks.validateTarget,
  validateCharacterConditionType: mocks.validateCondition
}))
vi.mock('./realtimeService.js', () => ({ broadcastCampaignInvalidation: mocks.broadcast }))

const {
  deleteCampaignAdjustment,
  listCampaignAdjustments,
  listCampaignConditions,
  saveCampaignAdjustment,
  saveCampaignCondition
} = await import('./campaignGmService.js')

function authority(role: 'OWNER' | 'PLAYER') {
  return {
    campaign: { id: ids.campaign, status: 'ACTIVE' as const },
    membership: { role, status: 'ACTIVE' as const },
    assignedCharacter: { id: ids.character, label: 'Rook', systemId: ids.campaign }
  }
}

describe('Campaign GM adjustment service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.authority.mockResolvedValue(authority('OWNER'))
    mocks.campaign.lockCampaign.mockResolvedValue({ id: ids.campaign })
    mocks.campaign.findAssignmentByCharacter.mockResolvedValue({ userId: ids.player })
    mocks.character.findAuthoredById.mockResolvedValue({
      systemId: ids.campaign,
      state: { equipment: { inventory: [] } }
    })
    mocks.resolveBuilder.mockResolvedValue({
      registry: { system: null },
      catalog: { equipment: [] }
    })
    mocks.adjustments.insertCampaignEvent.mockResolvedValue({
      id: ids.event,
      campaignId: ids.campaign,
      actorUserId: ids.owner,
      subjectUserId: null,
      subjectCharacterId: ids.character,
      kind: 'CAMPAIGN_ADJUSTMENT_SAVED',
      visibility: 'SUBJECT',
      payload: {},
      idempotencyKey: null,
      createdAt: '2026-08-01T00:00:00.000Z'
    })
  })

  it('hides secret adjustments from a player', async () => {
    mocks.authority.mockResolvedValue(authority('PLAYER'))
    mocks.adjustments.listAdjustments.mockResolvedValue([
      {
        id: ids.adjustment,
        campaignId: ids.campaign,
        characterId: ids.character,
        family: 'HIT_POINTS',
        slotKey: '["HIT_POINTS","MAXIMUM_MODIFIER"]',
        payload: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 2 },
        visibility: 'VISIBLE',
        createdBy: ids.owner,
        version: 0,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z'
      },
      {
        id: '00000000-0000-4000-8000-000000000007',
        campaignId: ids.campaign,
        characterId: ids.character,
        family: 'HIT_POINTS',
        slotKey: '["HIT_POINTS","MAXIMUM_OVERRIDE"]',
        payload: { family: 'HIT_POINTS', field: 'MAXIMUM_OVERRIDE', value: 9 },
        visibility: 'SECRET',
        createdBy: ids.owner,
        version: 0,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z'
      }
    ])

    await expect(
      listCampaignAdjustments({} as DBLike, ids.player, {
        campaignId: ids.campaign,
        characterId: ids.character
      })
    ).resolves.toEqual([expect.objectContaining({ visibility: 'VISIBLE' })])
  })

  it('saves a visible adjustment with a natural slot and a redacted event', async () => {
    mocks.adjustments.saveAdjustment.mockResolvedValue({
      id: ids.adjustment,
      campaignId: ids.campaign,
      characterId: ids.character,
      family: 'HIT_POINTS',
      slotKey: '["HIT_POINTS","MAXIMUM_MODIFIER"]',
      payload: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 2 },
      visibility: 'VISIBLE',
      createdBy: ids.owner,
      version: 0,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z'
    })

    await saveCampaignAdjustment({} as DBLike, ids.owner, {
      campaignId: ids.campaign,
      characterId: ids.character,
      adjustment: {
        family: 'HIT_POINTS',
        field: 'MAXIMUM_MODIFIER',
        value: 2,
        sourceNote: 'Blessing'
      },
      visibility: 'VISIBLE',
      expectedVersion: 0
    })

    expect(mocks.validateTarget).toHaveBeenCalledOnce()
    expect(mocks.adjustments.saveAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        slotKey: '["HIT_POINTS","MAXIMUM_MODIFIER"]',
        payload: {
          family: 'HIT_POINTS',
          field: 'MAXIMUM_MODIFIER',
          value: 2,
          sourceNote: 'Blessing'
        }
      })
    )
    expect(mocks.adjustments.insertCampaignEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: 'SUBJECT',
        payload: expect.not.objectContaining({ value: 2, sourceNote: 'Blessing' })
      })
    )
    expect(mocks.broadcast).toHaveBeenCalledWith(
      expect.anything(),
      ids.campaign,
      expect.objectContaining({ scope: 'TABLE', entity: 'CHARACTER', event: 'CREATED' })
    )
  })

  it('deletes optimistically and keeps a secret adjustment event owner-only', async () => {
    mocks.adjustments.listAdjustments.mockResolvedValue([
      {
        id: ids.adjustment,
        campaignId: ids.campaign,
        characterId: ids.character,
        family: 'HIT_POINTS',
        slotKey: '["HIT_POINTS","MAXIMUM_OVERRIDE"]',
        payload: {
          family: 'HIT_POINTS',
          field: 'MAXIMUM_OVERRIDE',
          value: 9,
          sourceNote: 'Hidden'
        },
        visibility: 'SECRET',
        createdBy: ids.owner,
        version: 2,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z'
      }
    ])
    mocks.adjustments.deleteAdjustmentById.mockResolvedValue(true)
    mocks.adjustments.insertCampaignEvent.mockResolvedValue({ id: ids.event })

    await deleteCampaignAdjustment({} as DBLike, ids.owner, {
      campaignId: ids.campaign,
      characterId: ids.character,
      adjustmentId: ids.adjustment,
      expectedVersion: 2
    })

    expect(mocks.adjustments.deleteAdjustmentById).toHaveBeenCalledWith({
      campaignId: ids.campaign,
      id: ids.adjustment,
      expectedVersion: 2
    })
    expect(mocks.adjustments.insertCampaignEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: 'OWNER',
        payload: expect.not.objectContaining({ value: 9 })
      })
    )
    expect(mocks.broadcast).toHaveBeenCalledWith(
      expect.anything(),
      ids.campaign,
      expect.objectContaining({ scope: 'OWNER', event: 'DELETED' })
    )
  })

  it('validates Campaign conditions and hides secret conditions from players', async () => {
    mocks.authority.mockResolvedValue(authority('PLAYER'))
    mocks.adjustments.listAdjustments.mockResolvedValue([
      {
        id: ids.adjustment,
        campaignId: ids.campaign,
        characterId: ids.character,
        family: 'CONDITION',
        slotKey: ids.adjustment,
        payload: { conditionTypeId: ids.adjustment },
        visibility: 'SECRET',
        createdBy: ids.owner,
        version: 0,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z'
      }
    ])
    await expect(
      listCampaignConditions({} as DBLike, ids.player, {
        campaignId: ids.campaign,
        characterId: ids.character
      })
    ).resolves.toEqual([])

    mocks.authority.mockResolvedValue(authority('OWNER'))
    mocks.adjustments.saveAdjustment.mockResolvedValue({
      id: ids.adjustment,
      campaignId: ids.campaign,
      characterId: ids.character,
      family: 'CONDITION',
      slotKey: ids.adjustment,
      payload: { conditionTypeId: ids.adjustment },
      visibility: 'VISIBLE',
      createdBy: ids.owner,
      version: 0,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z'
    })
    await saveCampaignCondition({} as DBLike, ids.owner, {
      campaignId: ids.campaign,
      characterId: ids.character,
      conditionTypeId: ids.adjustment,
      visibility: 'VISIBLE',
      expectedVersion: 0
    })
    expect(mocks.validateCondition).toHaveBeenCalledWith(
      mocks.transaction,
      ids.campaign,
      ids.adjustment
    )
  })
})
