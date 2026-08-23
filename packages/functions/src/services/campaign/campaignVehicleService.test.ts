import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  user: '00000000-0000-4000-8000-000000000002',
  author: '00000000-0000-4000-8000-000000000003',
  vehicle: '00000000-0000-4000-8000-000000000004',
  instance: '00000000-0000-4000-8000-000000000005',
  version: '00000000-0000-4000-8000-000000000006'
}

const mocks = vi.hoisted(() => ({
  shares: {
    findShare: vi.fn(),
    lockCurrentRoot: vi.fn(),
    listCurrentSources: vi.fn(),
    lockSharesForUse: vi.fn()
  },
  campaign: { lockCampaign: vi.fn() },
  vehicles: { find: vi.fn(), insert: vi.fn(), list: vi.fn(), update: vi.fn() },
  authority: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createCampaignContentShareRepository: () => mocks.shares,
  createCampaignRepository: () => mocks.campaign,
  createCampaignVehicleRepository: () => mocks.vehicles,
  withTransaction: async (_db: DBLike, fn: (trx: DBLike) => Promise<unknown>) => fn({} as DBLike)
}))
vi.mock('./campaignService.js', () => ({
  assertActiveCampaignMember: vi.fn(),
  assertCampaignOwner: vi.fn(),
  assertCampaignWritable: vi.fn(),
  CampaignAccessError: class CampaignAccessError extends Error {},
  CampaignConflictError: class CampaignConflictError extends Error {},
  resolveCampaignAuthority: mocks.authority
}))

const { createCampaignVehicle, listCampaignVehicles, updateCampaignVehicle } =
  await import('./campaignVehicleService.js')

function vehicle() {
  return {
    id: ids.instance,
    campaignId: ids.campaign,
    vehicleDefinitionId: ids.vehicle,
    label: null,
    version: 1,
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z'
  }
}

describe('Campaign Vehicle definition access', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.campaign.lockCampaign.mockResolvedValue({ id: ids.campaign })
    mocks.authority.mockResolvedValue({ campaign: { status: 'ACTIVE' } })
    mocks.vehicles.insert.mockResolvedValue(vehicle())
    mocks.vehicles.list.mockResolvedValue([vehicle()])
    mocks.vehicles.find.mockResolvedValue(vehicle())
    mocks.vehicles.update.mockResolvedValue({ ...vehicle(), version: 2 })
    mocks.shares.lockSharesForUse.mockResolvedValue({ locked: [], missing: [] })
  })

  it('creates an instance against a current Master Vehicle root', async () => {
    mocks.shares.findShare.mockResolvedValue(null)
    mocks.shares.lockCurrentRoot.mockResolvedValue({ isMaster: true })

    await expect(
      createCampaignVehicle({} as DBLike, ids.user, {
        campaignId: ids.campaign,
        vehicleDefinitionId: ids.vehicle,
        label: null
      })
    ).resolves.toEqual(vehicle())
    expect(mocks.vehicles.insert).toHaveBeenCalledWith({
      campaignId: ids.campaign,
      vehicleDefinitionId: ids.vehicle,
      label: null
    })
  })

  it('creates an instance only after exact current Campaign share-use locking', async () => {
    const share = {
      campaignId: ids.campaign,
      subjectKind: 'VEHICLE' as const,
      subjectId: ids.vehicle,
      sharedBy: ids.author
    }
    const source = {
      authored: {
        versionId: ids.version,
        version: 2,
        checksum: 'a'.repeat(64)
      }
    }
    mocks.shares.findShare.mockResolvedValue(share)
    mocks.shares.listCurrentSources.mockResolvedValue([{ share, source }])

    await createCampaignVehicle({} as DBLike, ids.user, {
      campaignId: ids.campaign,
      vehicleDefinitionId: ids.vehicle,
      label: null
    })

    expect(mocks.shares.lockSharesForUse).toHaveBeenCalledWith({
      campaignId: ids.campaign,
      shares: [
        {
          subjectKind: 'VEHICLE',
          subjectId: ids.vehicle,
          sharedBy: ids.author,
          versionId: ids.version,
          version: 2,
          checksum: 'a'.repeat(64)
        }
      ]
    })
  })

  it('fails closed when the exact share or current definition is unavailable', async () => {
    mocks.shares.findShare.mockResolvedValue({
      campaignId: ids.campaign,
      subjectKind: 'VEHICLE',
      subjectId: ids.vehicle,
      sharedBy: ids.author
    })
    mocks.shares.listCurrentSources.mockResolvedValue([])

    await expect(
      createCampaignVehicle({} as DBLike, ids.user, {
        campaignId: ids.campaign,
        vehicleDefinitionId: ids.vehicle,
        label: null
      })
    ).rejects.toThrow('current Master Vehicle or a Vehicle shared')
    expect(mocks.vehicles.insert).not.toHaveBeenCalled()
  })

  it('does not hide an existing instance when its definition later becomes unavailable', async () => {
    await expect(listCampaignVehicles({} as DBLike, ids.user, ids.campaign)).resolves.toEqual([
      vehicle()
    ])
    expect(mocks.shares.findShare).not.toHaveBeenCalled()
  })

  it('fails a definition-dependent update closed without removing the instance', async () => {
    mocks.shares.findShare.mockResolvedValue(null)
    mocks.shares.lockCurrentRoot.mockResolvedValue({ isMaster: false })

    await expect(
      updateCampaignVehicle({} as DBLike, ids.user, {
        campaignId: ids.campaign,
        vehicleId: ids.instance,
        label: 'Unavailable wagon',
        expectedVersion: 1
      })
    ).rejects.toThrow('definition is no longer available')
    expect(mocks.vehicles.update).not.toHaveBeenCalled()
  })
})
