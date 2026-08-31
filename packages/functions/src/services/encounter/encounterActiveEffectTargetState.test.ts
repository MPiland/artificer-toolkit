import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  encounter: '00000000-0000-4000-8000-000000000002',
  system: '00000000-0000-4000-8000-000000000003',
  characterA: '00000000-0000-4000-8000-000000000004',
  characterB: '00000000-0000-4000-8000-000000000005',
  actorA: '00000000-0000-4000-8000-000000000006',
  actorB: '00000000-0000-4000-8000-000000000007',
  creature: '00000000-0000-4000-8000-000000000008'
}

const state = vi.hoisted(() => ({
  lockAssignment: vi.fn(),
  requireCurrent: vi.fn(),
  requireOverlay: vi.fn(),
  lockRoot: vi.fn(),
  vocabulary: vi.fn(),
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
    createCharacterMechanicsProjectionRepository: () => ({ requireCurrent: state.requireCurrent }),
    createSystemVocabularySnapshotRepository: () => ({ findById: state.vocabulary })
  }
})
vi.mock('../character/campaignCharacterSheet.js', () => ({
  checksumCampaignCharacterMechanicalContext: () => 'a'.repeat(64),
  resolveCharacterLiveSessionRuleContext: state.ruleContext
}))
vi.mock('../campaign/campaignCharacterMechanicsProjection.js', () => ({
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION: 1
}))

import {
  lockEncounterActiveEffectTargets,
  refreshLockedEncounterActiveEffectTargets
} from './encounterActiveEffectTargetState.js'

function actor(id: string, characterId: string) {
  return {
    id,
    kind: 'CHARACTER' as const,
    sourceId: characterId,
    sourceRevision: 4,
    systemId: ids.system,
    currentHitPoints: 5,
    maxHitPoints: 10,
    tempHitPoints: 0
  }
}

function creature() {
  return {
    id: ids.creature,
    kind: 'CREATURE' as const,
    sourceId: null,
    sourceRevision: 1,
    systemId: ids.system,
    currentHitPoints: 5,
    maxHitPoints: 10,
    tempHitPoints: 0
  }
}

const encounter = {
  id: ids.encounter,
  campaignId: ids.campaign,
  gameSystemId: ids.system
}

function db(
  rows = new Map([
    [
      ids.characterA,
      { id: ids.characterA, system_id: ids.system, stream_version: 4, status: 'ACTIVE' }
    ],
    [
      ids.characterB,
      { id: ids.characterB, system_id: ids.system, stream_version: 4, status: 'ACTIVE' }
    ]
  ])
) {
  return {
    selectFrom: () => ({
      select: () => ({
        where: (_column: string, _operator: string, id: string) => {
          const read = { executeTakeFirst: async () => rows.get(id) }
          return {
            ...read,
            forUpdate: () => {
              state.lockRoot()
              return read
            }
          }
        }
      })
    })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  state.lockAssignment.mockResolvedValue(undefined)
  state.lockRoot.mockReset()
  state.requireCurrent.mockImplementation(async ({ characterId }: { characterId: string }) => ({
    characterStreamVersion: 4,
    projectionChecksum: 'b'.repeat(64),
    systemVocabularySnapshotId: ids.system,
    systemVocabularySnapshotVersion: 1,
    systemVocabularySnapshotChecksum: 'c'.repeat(64),
    commandState: { state: { hitpoints: { current: 5, temp: 0 } } },
    characterId
  }))
  state.requireOverlay.mockImplementation(async ({ characterId }: { characterId: string }) => ({
    characterId,
    rulePolicyOutput: { derivedStats: { maxHitPoints: { effective: 10 } } }
  }))
  state.vocabulary.mockResolvedValue({
    systemId: ids.system,
    snapshotVersion: 1,
    checksum: 'c'.repeat(64),
    document: { conditionTypes: [] }
  })
  state.ruleContext.mockResolvedValue({ adjustments: [], attunementSlotOverride: null })
})

describe('lockEncounterActiveEffectTargets', () => {
  it('locks assignments and Character roots in sorted identity order', async () => {
    const result = await lockEncounterActiveEffectTargets({
      trx: db() as never,
      encounter: encounter as never,
      actors: [actor(ids.actorB, ids.characterB), actor(ids.actorA, ids.characterA)] as never,
      attunementSlotOverride: null
    })
    expect(result.characterIds).toEqual([ids.characterA, ids.characterB])
    expect(state.lockAssignment.mock.calls.map(([input]) => input.characterId)).toEqual([
      ids.characterA,
      ids.characterB
    ])
    expect(state.requireCurrent.mock.calls.map(([input]) => input.characterId)).toEqual([
      ids.characterA,
      ids.characterB
    ])
  })

  it('rejects a stale Character source before loading mechanics', async () => {
    await expect(
      lockEncounterActiveEffectTargets({
        trx: db(
          new Map([
            [
              ids.characterA,
              { id: ids.characterA, system_id: ids.system, stream_version: 5, status: 'ACTIVE' }
            ]
          ])
        ) as never,
        encounter: encounter as never,
        actors: [actor(ids.actorA, ids.characterA)] as never,
        attunementSlotOverride: null
      })
    ).rejects.toThrow('The Encounter Character source is stale.')
    expect(state.requireCurrent).not.toHaveBeenCalled()
  })

  it('rejects a stale Character projection or vocabulary snapshot', async () => {
    state.requireOverlay.mockRejectedValueOnce(new Error('projection stale'))
    await expect(
      lockEncounterActiveEffectTargets({
        trx: db() as never,
        encounter: encounter as never,
        actors: [actor(ids.actorA, ids.characterA)] as never,
        attunementSlotOverride: null
      })
    ).rejects.toThrow('projection stale')
    state.requireOverlay.mockResolvedValueOnce({
      rulePolicyOutput: { derivedStats: { maxHitPoints: { effective: 10 } } }
    })
    state.vocabulary.mockResolvedValueOnce(null)
    await expect(
      lockEncounterActiveEffectTargets({
        trx: db() as never,
        encounter: encounter as never,
        actors: [actor(ids.actorA, ids.characterA)] as never,
        attunementSlotOverride: null
      })
    ).rejects.toThrow('The Character System vocabulary snapshot is stale.')
  })

  it('maps mixed Character and reconciled Encounter targets', async () => {
    const updatedCreature = { ...creature(), currentHitPoints: 4 }
    const result = await lockEncounterActiveEffectTargets({
      trx: db() as never,
      encounter: encounter as never,
      actors: [actor(ids.actorA, ids.characterA), creature()] as never,
      attunementSlotOverride: null,
      getEncounterActorSnapshot: async () => ({
        rules: { actors: [] } as never,
        encounter: { actors: [updatedCreature] } as never
      })
    })
    expect(result.lockedCharacters.get(ids.characterA)?.actor.id).toBe(ids.actorA)
    expect(result.encounterActors.get(ids.creature)).toEqual(updatedCreature)
    expect(result.encounterActorRules).toEqual({ actors: [] })
  })

  it('rejects a stale Encounter actor mapping', async () => {
    await expect(
      lockEncounterActiveEffectTargets({
        trx: db() as never,
        encounter: encounter as never,
        actors: [creature()] as never,
        attunementSlotOverride: null,
        getEncounterActorSnapshot: async () => ({
          rules: { actors: [] } as never,
          encounter: { actors: [] } as never
        })
      })
    ).rejects.toThrow('Encounter actor changed before active-effect execution.')
  })

  it('does not mutate supplied actor records', async () => {
    const supplied = actor(ids.actorA, ids.characterA)
    await lockEncounterActiveEffectTargets({
      trx: db() as never,
      encounter: encounter as never,
      actors: [supplied] as never,
      attunementSlotOverride: null
    })
    expect(supplied).toEqual(actor(ids.actorA, ids.characterA))
  })

  it('refreshes post-prefix Character facts without reacquiring the Character root', async () => {
    const rows = new Map([
      [
        ids.characterA,
        { id: ids.characterA, system_id: ids.system, stream_version: 4, status: 'ACTIVE' }
      ]
    ])
    const targets = await lockEncounterActiveEffectTargets({
      trx: db(rows) as never,
      encounter: encounter as never,
      actors: [actor(ids.actorA, ids.characterA)] as never,
      attunementSlotOverride: null
    })
    rows.set(ids.characterA, {
      id: ids.characterA,
      system_id: ids.system,
      stream_version: 5,
      status: 'ACTIVE'
    })
    state.requireCurrent.mockResolvedValueOnce({
      ...(await state.requireCurrent.mock.results[0]?.value),
      characterStreamVersion: 5,
      commandState: { state: { hitpoints: { current: 1, temp: 0 }, conditions: [] } }
    })

    const refreshed = await refreshLockedEncounterActiveEffectTargets({
      trx: db(rows) as never,
      encounter: {
        ...encounter,
        actors: [{ ...actor(ids.actorA, ids.characterA), sourceRevision: 5, currentHitPoints: 1 }]
      } as never,
      targets,
      attunementSlotOverride: null
    })

    expect(refreshed.lockedCharacters.get(ids.characterA)).toMatchObject({
      streamVersion: 5,
      actor: { sourceRevision: 5, currentHitPoints: 1 },
      mechanics: { characterStreamVersion: 5 }
    })
    expect(state.lockRoot).toHaveBeenCalledTimes(1)
    expect(state.lockAssignment).toHaveBeenCalledTimes(1)
    expect(state.requireCurrent).toHaveBeenLastCalledWith({
      characterId: ids.characterA,
      expectedStreamVersion: 5
    })
  })
})
