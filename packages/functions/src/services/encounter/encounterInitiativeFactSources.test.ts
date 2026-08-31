import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  encounter: '00000000-0000-4000-8000-000000000002',
  system: '00000000-0000-0000-0000-000000000001',
  unknownSystem: '00000000-0000-4000-8000-000000000099',
  characterA: '00000000-0000-4000-8000-000000000003',
  characterB: '00000000-0000-4000-8000-000000000004',
  actorA: '00000000-0000-4000-8000-000000000005',
  actorB: '00000000-0000-4000-8000-000000000006',
  creature: '00000000-0000-4000-8000-000000000007',
  custom: '00000000-0000-4000-8000-000000000008'
}

const state = vi.hoisted(() => ({
  lockAssignment: vi.fn(),
  requireCurrent: vi.fn(),
  requireOverlay: vi.fn(),
  ruleContext: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignCharacterMechanicsProjectionRepository: () => ({
      lockAssignment: state.lockAssignment,
      requireCurrent: state.requireOverlay
    }),
    createCharacterMechanicsProjectionRepository: () => ({
      requireCurrent: state.requireCurrent
    })
  }
})
vi.mock('../character/campaignCharacterSheet.js', () => ({
  checksumCampaignCharacterMechanicalContext: () => 'a'.repeat(64),
  resolveCharacterLiveSessionRuleContext: state.ruleContext
}))
vi.mock('../campaign/campaignCharacterMechanicsProjection.js', () => ({
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION: 1
}))

import { lockEncounterInitiativeFactSources } from './encounterInitiativeFactSources.js'

function character(actorId: string, characterId: string) {
  return {
    id: actorId,
    kind: 'CHARACTER' as const,
    sourceId: characterId,
    sourceRevision: 4,
    systemId: ids.system
  }
}

function creature() {
  return {
    id: ids.creature,
    kind: 'CREATURE' as const,
    sourceId: '00000000-0000-4000-8000-000000000009',
    sourceRevision: 1,
    systemId: ids.system,
    snapshot: { payload: { senses: ['raw creature prose'] } }
  }
}

function custom() {
  return {
    id: ids.custom,
    kind: 'CUSTOM' as const,
    sourceId: null,
    sourceRevision: null,
    systemId: null,
    snapshot: { payload: { senses: ['raw custom prose'] } }
  }
}

const encounter = {
  id: ids.encounter,
  campaignId: ids.campaign,
  gameSystemId: ids.system
}

function db() {
  const rows = new Map(
    [ids.characterA, ids.characterB].map((id) => [
      id,
      { id, system_id: ids.system, stream_version: 4, status: 'ACTIVE' }
    ])
  )
  return {
    selectFrom: () => ({
      select: () => ({
        where: (_column: string, _operator: string, id: string) => ({
          forUpdate: () => ({ executeTakeFirst: async () => rows.get(id) })
        })
      })
    })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  state.lockAssignment.mockResolvedValue(undefined)
  state.requireCurrent.mockImplementation(async ({ characterId }: { characterId: string }) => ({
    characterId,
    projectionChecksum: 'b'.repeat(64)
  }))
  state.requireOverlay.mockImplementation(async ({ characterId }: { characterId: string }) => ({
    characterId,
    rulePolicyOutput: {
      derivedStats: { initiative: { effective: 6 } },
      rollModes: { initiative: 'ADVANTAGE' }
    }
  }))
  state.ruleContext.mockResolvedValue({ adjustments: [], attunementSlotOverride: null })
})

describe('lockEncounterInitiativeFactSources', () => {
  it('locks Campaign assignments and Character roots in canonical order without viewer input', async () => {
    const result = await lockEncounterInitiativeFactSources({
      trx: db() as never,
      encounter: encounter as never,
      actors: [
        character(ids.actorB, ids.characterB),
        character(ids.actorA, ids.characterA)
      ] as never,
      attunementSlotOverride: null
    })

    expect(state.lockAssignment.mock.calls.map(([input]) => input.characterId)).toEqual([
      ids.characterA,
      ids.characterB
    ])
    expect(state.requireCurrent.mock.calls.map(([input]) => input.characterId)).toEqual([
      ids.characterA,
      ids.characterB
    ])
    expect(result.actors.map((source) => source.actor.id)).toEqual([ids.actorA, ids.actorB])
    expect(state.requireOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: ids.campaign, characterId: ids.characterA })
    )
  })

  it('uses reconciled Creature policy output and preserves Custom as statless', async () => {
    const originalCreature = creature()
    const originalCustom = custom()
    const result = await lockEncounterInitiativeFactSources({
      trx: db() as never,
      encounter: encounter as never,
      actors: [originalCustom, originalCreature] as never,
      attunementSlotOverride: null,
      getEncounterActorSnapshot: async () => ({
        encounter: { actors: [originalCreature, originalCustom] } as never,
        rules: {
          actors: [
            {
              actorId: ids.creature,
              initiativeModifier: 7,
              targetProtection: { status: 'NOT_NORMALIZED' },
              featureResources: []
            }
          ]
        } as never
      })
    })

    expect(result.actors).toEqual([
      expect.objectContaining({
        kind: 'CREATURE',
        actorRule: expect.objectContaining({ initiativeModifier: 7 })
      }),
      expect.objectContaining({ kind: 'CUSTOM', systemId: null })
    ])
  })

  it('fails closed when non-Character policy evidence is unavailable', async () => {
    await expect(
      lockEncounterInitiativeFactSources({
        trx: db() as never,
        encounter: encounter as never,
        actors: [creature()] as never,
        attunementSlotOverride: null
      })
    ).rejects.toThrow('Encounter actor rules are required for initiative facts.')
  })
})
