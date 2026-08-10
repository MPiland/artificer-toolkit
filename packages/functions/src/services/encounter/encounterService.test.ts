import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  owner: '00000000-0000-4000-8000-000000000002',
  creature: '00000000-0000-4000-8000-000000000003',
  system: '00000000-0000-4000-8000-000000000004',
  template: '00000000-0000-4000-8000-000000000005',
  command: '00000000-0000-4000-8000-000000000006'
}

const mocks = vi.hoisted(() => ({
  db: {} as DBLike,
  entitlements: { lockTier: vi.fn() },
  creature: { findByIds: vi.fn() },
  encounter: {
    countTemplatesForOwner: vi.fn(),
    createTemplate: vi.fn(),
    findTemplateByCampaignCommand: vi.fn()
  }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createAccountEntitlementsRepository: () => mocks.entitlements,
    createCreatureRepository: () => mocks.creature,
    createEncounterRepository: () => mocks.encounter,
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.db)
  }
})

vi.mock('../campaign/campaignService.js', () => ({
  assertCampaignOwner: vi.fn(),
  assertCampaignWritable: vi.fn(),
  resolveCampaignAuthority: vi.fn(async () => ({
    campaign: { id: ids.campaign, status: 'ACTIVE' },
    membership: {
      role: 'OWNER',
      status: 'ACTIVE',
      accessStartedAt: '2026-08-01T00:00:00.000Z'
    }
  })),
  CampaignConflictError: class CampaignConflictError extends Error {},
  assertActiveCampaignMember: vi.fn()
}))

import { createEncounterTemplate } from './encounterService.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.entitlements.lockTier.mockResolvedValue('FREE')
  mocks.encounter.countTemplatesForOwner.mockResolvedValue(0)
  mocks.encounter.findTemplateByCampaignCommand.mockResolvedValue(null)
  mocks.creature.findByIds.mockResolvedValue(
    new Map([
      [
        ids.creature,
        {
          id: ids.creature,
          label: 'Server creature',
          systemId: ids.system,
          status: 'ACTIVE',
          hitPoints: 8
        }
      ]
    ])
  )
  mocks.encounter.createTemplate.mockImplementation(async (input) => ({
    id: ids.template,
    campaignId: ids.campaign,
    name: input.name,
    version: 1,
    enemies: input.enemies,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z'
  }))
})

describe('encounter template authority', () => {
  it('resolves Creature labels and stats from the authored repository', async () => {
    await createEncounterTemplate({} as DBLike, ids.owner, {
      campaignId: ids.campaign,
      name: 'Goblin ambush',
      enemies: [{ kind: 'CREATURE', sourceId: ids.creature }],
      commandId: ids.command
    })

    expect(mocks.creature.findByIds).toHaveBeenCalledWith([ids.creature], {
      userId: ids.owner,
      includeMaster: true
    })
    expect(mocks.encounter.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        enemies: [
          expect.objectContaining({
            kind: 'CREATURE',
            sourceId: ids.creature,
            sourceRevision: null,
            label: 'Server creature',
            systemId: ids.system,
            maxHitPoints: 8,
            snapshot: expect.objectContaining({
              payload: expect.objectContaining({ label: 'Server creature', hitPoints: 8 })
            })
          })
        ]
      })
    )
  })

  it('returns an identical template retry before consuming quota', async () => {
    const input = {
      campaignId: ids.campaign,
      name: 'Goblin ambush',
      enemies: [{ kind: 'CREATURE' as const, sourceId: ids.creature }],
      commandId: ids.command
    }
    const template = await createEncounterTemplate({} as DBLike, ids.owner, input)
    const created = mocks.encounter.createTemplate.mock.calls[0]?.[0]
    mocks.encounter.findTemplateByCampaignCommand.mockResolvedValue({
      template,
      commandFingerprint: created.commandFingerprint
    })
    mocks.encounter.createTemplate.mockClear()
    mocks.entitlements.lockTier.mockClear()
    mocks.creature.findByIds.mockClear()

    await expect(createEncounterTemplate({} as DBLike, ids.owner, input)).resolves.toMatchObject({
      id: ids.template
    })
    expect(mocks.entitlements.lockTier).not.toHaveBeenCalled()
    expect(mocks.creature.findByIds).not.toHaveBeenCalled()
    expect(mocks.encounter.createTemplate).not.toHaveBeenCalled()
  })

  it('rejects a template command reused with different input', async () => {
    mocks.encounter.findTemplateByCampaignCommand.mockResolvedValue({
      template: {
        id: ids.template,
        campaignId: ids.campaign,
        name: 'Earlier template',
        version: 1,
        enemies: [],
        createdAt: '2026-08-07T00:00:00.000Z',
        updatedAt: '2026-08-07T00:00:00.000Z'
      },
      commandFingerprint: 'different'
    })

    await expect(
      createEncounterTemplate({} as DBLike, ids.owner, {
        campaignId: ids.campaign,
        name: 'Goblin ambush',
        enemies: [{ kind: 'CREATURE', sourceId: ids.creature }],
        commandId: ids.command
      })
    ).rejects.toMatchObject({ name: 'EncounterConflictError' })
    expect(mocks.entitlements.lockTier).not.toHaveBeenCalled()
    expect(mocks.encounter.createTemplate).not.toHaveBeenCalled()
  })

  it('rejects oversized resolved creature snapshots before persistence', async () => {
    mocks.creature.findByIds.mockResolvedValue(
      new Map([
        [
          ids.creature,
          {
            id: ids.creature,
            label: 'Server creature',
            systemId: ids.system,
            status: 'ACTIVE',
            hitPoints: 8,
            description: 'x'.repeat(AUTHORED_LIMITS.mutationPayloadBytes)
          }
        ]
      ])
    )

    await expect(
      createEncounterTemplate({} as DBLike, ids.owner, {
        campaignId: ids.campaign,
        name: 'Oversized ambush',
        enemies: [{ kind: 'CREATURE', sourceId: ids.creature }],
        commandId: ids.command
      })
    ).rejects.toMatchObject({ name: 'EncounterValidationError' })
    expect(mocks.encounter.createTemplate).not.toHaveBeenCalled()
  })
})
