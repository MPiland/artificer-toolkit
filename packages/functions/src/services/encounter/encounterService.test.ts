import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { createCreature } from '../character/sheetTestFixtures.js'

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
  authoredVersions: { findActiveByIds: vi.fn() },
  encounter: {
    countTemplatesForOwner: vi.fn(),
    createTemplate: vi.fn(),
    find: vi.fn(),
    findTemplateByCampaignCommand: vi.fn(),
    findVersionMetadata: vi.fn(),
    requireCurrentProjection: vi.fn()
  }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createAccountEntitlementsRepository: () => mocks.entitlements,
    createAuthoredVersionRepository: () => mocks.authoredVersions,
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

import { createEncounterTemplate, getEncounterProjection } from './encounterService.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.entitlements.lockTier.mockResolvedValue('FREE')
  mocks.encounter.countTemplatesForOwner.mockResolvedValue(0)
  mocks.encounter.findTemplateByCampaignCommand.mockResolvedValue(null)
  mocks.encounter.findVersionMetadata.mockResolvedValue({
    campaignId: ids.campaign,
    id: ids.command,
    sessionId: ids.template,
    status: 'ACTIVE',
    version: 7
  })
  mocks.encounter.requireCurrentProjection.mockResolvedValue({
    projection: { id: ids.command, version: 7 }
  })
  const creature = createCreature({
    id: ids.creature,
    systemId: ids.system,
    userId: ids.owner,
    status: 'ACTIVE',
    hitPoints: 8
  })
  mocks.authoredVersions.findActiveByIds.mockResolvedValue(
    new Map([
      [
        ids.creature,
        {
          authored: {
            document: creature,
            versionId: 'creature-version-1',
            version: 1,
            checksum: 'a'.repeat(64)
          }
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
  it('pins Creature labels and stats from the active immutable version', async () => {
    await createEncounterTemplate({} as DBLike, ids.owner, {
      campaignId: ids.campaign,
      name: 'Goblin ambush',
      enemies: [{ kind: 'CREATURE', sourceId: ids.creature }],
      commandId: ids.command
    })

    expect(mocks.authoredVersions.findActiveByIds).toHaveBeenCalledWith({
      subjectKind: 'CREATURE',
      subjectIds: [ids.creature],
      userId: ids.owner,
      includeMaster: true
    })
    expect(mocks.encounter.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        enemies: [
          expect.objectContaining({
            kind: 'CREATURE',
            sourceId: ids.creature,
            sourceRevision: 1,
            label: 'Owl',
            systemId: ids.system,
            maxHitPoints: 8,
            snapshot: expect.objectContaining({
              sourceVersionId: 'creature-version-1',
              sourceChecksum: 'a'.repeat(64),
              payload: expect.objectContaining({ label: 'Owl', hitPoints: 8 })
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
    mocks.authoredVersions.findActiveByIds.mockClear()

    await expect(createEncounterTemplate({} as DBLike, ids.owner, input)).resolves.toMatchObject({
      id: ids.template
    })
    expect(mocks.entitlements.lockTier).not.toHaveBeenCalled()
    expect(mocks.authoredVersions.findActiveByIds).not.toHaveBeenCalled()
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
    const creature = createCreature({
      id: ids.creature,
      systemId: ids.system,
      userId: ids.owner,
      status: 'ACTIVE',
      hitPoints: 8,
      description: 'x'.repeat(AUTHORED_LIMITS.mutationPayloadBytes)
    })
    mocks.authoredVersions.findActiveByIds.mockResolvedValue(
      new Map([
        [
          ids.creature,
          {
            authored: {
              document: creature,
              versionId: 'creature-version-1',
              version: 1,
              checksum: 'a'.repeat(64)
            }
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

describe('Encounter projection reads', () => {
  it('locates the current projection through its small relational envelope', async () => {
    await expect(getEncounterProjection({} as DBLike, ids.owner, ids.command)).resolves.toEqual({
      id: ids.command,
      version: 7
    })

    expect(mocks.encounter.findVersionMetadata).toHaveBeenCalledWith(ids.command)
    expect(mocks.encounter.requireCurrentProjection).toHaveBeenCalledWith({
      encounterId: ids.command,
      expectedStreamVersion: 7
    })
    expect(mocks.encounter.find).not.toHaveBeenCalled()
  })
})
