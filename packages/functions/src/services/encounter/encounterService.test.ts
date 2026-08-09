import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

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
  creature: { findById: vi.fn() },
  encounter: { countTemplatesForOwner: vi.fn(), createTemplate: vi.fn(), find: vi.fn() }
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
    membership: { role: 'OWNER', status: 'ACTIVE' }
  })),
  CampaignConflictError: class CampaignConflictError extends Error {},
  assertActiveCampaignMember: vi.fn()
}))

import { createEncounterTemplate, getEncounterProjection } from './encounterService.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.entitlements.lockTier.mockResolvedValue('FREE')
  mocks.encounter.countTemplatesForOwner.mockResolvedValue(0)
  mocks.creature.findById.mockResolvedValue({
    id: ids.creature,
    label: 'Server creature',
    systemId: ids.system,
    status: 'ACTIVE',
    hitPoints: 8
  })
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

    expect(mocks.creature.findById).toHaveBeenCalledWith(ids.creature, {
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

  it('projects immutable Creature actions to the GM', async () => {
    mocks.encounter.find.mockResolvedValue({
      id: ids.command,
      campaignId: ids.campaign,
      sessionId: ids.command,
      templateId: ids.template,
      templateVersion: 1,
      name: 'Goblin ambush',
      status: 'ACTIVE',
      version: 1,
      round: 1,
      currentActorId: null,
      actors: [
        {
          id: ids.creature,
          encounterId: ids.command,
          kind: 'CREATURE',
          sourceId: ids.creature,
          sourceRevision: null,
          label: 'Server creature',
          systemId: ids.system,
          stableTieKey: ids.creature,
          public: true,
          currentHitPoints: 8,
          maxHitPoints: 8,
          tempHitPoints: 0,
          conditions: [],
          resources: { featureCharges: { scimitar: 1 } },
          gmNotes: null,
          initiative: 12,
          manualOrder: null,
          snapshot: {
            kind: 'CREATURE',
            payload: {
              features: [
                {
                  id: 'scimitar',
                  label: 'Scimitar',
                  description: '<p>Melee weapon attack.</p>',
                  section: 'ACTION',
                  order: 1,
                  charges: {
                    id: 'scimitar-charges',
                    resetKind: 'MANUAL',
                    limitKind: 'FIXED_AMOUNT',
                    scalingKind: 'NONE',
                    amount: 2
                  }
                }
              ]
            }
          },
          createdAt: '2026-08-07T00:00:00.000Z',
          updatedAt: '2026-08-07T00:00:00.000Z'
        }
      ],
      reminders: [],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    })

    const projection = await getEncounterProjection(mocks.db, ids.owner, ids.command)

    expect(projection.actors[0]).toMatchObject({
      features: [
        {
          label: 'Scimitar',
          section: 'ACTION',
          resource: {
            used: 1,
            maximum: 2,
            remaining: 1,
            resetKind: 'MANUAL'
          }
        }
      ]
    })
  })
})
