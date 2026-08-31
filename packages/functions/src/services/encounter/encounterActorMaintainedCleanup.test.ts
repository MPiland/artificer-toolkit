import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  encounter: '00000000-0000-4000-8000-000000000002',
  removedActor: '00000000-0000-4000-8000-000000000003',
  character: '00000000-0000-4000-8000-000000000004',
  characterActor: '00000000-0000-4000-8000-000000000005',
  state: '00000000-0000-4000-8000-000000000006',
  foreignState: '00000000-0000-4000-8000-000000000007',
  definition: '00000000-0000-4000-8000-000000000008',
  characterEffect: '00000000-0000-4000-8000-000000000009',
  actorEffect: '00000000-0000-4000-8000-000000000010'
}

const mocks = vi.hoisted(() => ({
  locator: vi.fn(),
  lockStates: vi.fn(),
  lockState: vi.fn(),
  lockDependents: vi.fn(),
  lockByOwner: vi.fn(),
  deleteEffect: vi.fn(),
  deleteState: vi.fn(),
  assignmentIfPresent: vi.fn(),
  guard: vi.fn(),
  mechanics: vi.fn(),
  overlay: vi.fn(),
  patch: vi.fn(),
  advance: vi.fn(),
  publish: vi.fn(),
  context: vi.fn()
}))

vi.mock('@artificer-toolkit/db', () => ({
  createActiveRuleEffectRepository: () => ({
    listCharacterOwnersForActorRemovalCleanup: mocks.locator,
    lockMaintainedStatesByOwner: mocks.lockStates,
    lockMaintainedStateById: mocks.lockState,
    lockDependentEffects: mocks.lockDependents,
    lockByOwner: mocks.lockByOwner,
    deleteCas: mocks.deleteEffect,
    deleteMaintainedStateCas: mocks.deleteState
  }),
  createCampaignCharacterMechanicsProjectionRepository: () => ({
    lockAssignmentIfPresent: mocks.assignmentIfPresent,
    requireCurrent: mocks.overlay,
    publish: mocks.publish
  }),
  createCharacterMechanicsProjectionRepository: () => ({
    requireCurrent: mocks.mechanics,
    advanceLiveCommandState: mocks.advance
  }),
  createCharacterRepository: () => ({ patchSheetState: mocks.patch })
}))
vi.mock('../character/characterAssignmentAuthority.js', () => ({
  lockCharacterAssignmentAuthority: mocks.guard
}))
vi.mock('../character/campaignCharacterSheet.js', () => ({
  checksumCampaignCharacterMechanicalContext: () => 'a'.repeat(64),
  resolveCharacterLiveSessionRuleContext: mocks.context
}))
vi.mock('../character/characterMechanicsCompiler.js', () => ({
  advanceCharacterMechanicsProjectionCommandState: () => ({ projectionChecksum: 'b'.repeat(64) })
}))
vi.mock('../campaign/campaignCharacterMechanicsProjection.js', () => ({
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION: 1,
  compileCampaignCharacterMechanicsProjection: () => ({})
}))

import { cleanupRemovedEncounterActorMaintainedEffects } from './encounterActorMaintainedCleanup.js'

function characterEffect(id = ids.characterEffect) {
  return {
    id,
    owner: { kind: 'CHARACTER' as const, characterId: ids.character },
    createdOrdinal: 1,
    version: 1,
    definitionChecksum: 'c'.repeat(64),
    lifecycleChecksum: 'd'.repeat(64)
  }
}
function actorEffect(stateId: string | null = null) {
  return {
    id: ids.actorEffect,
    owner: {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: ids.encounter,
      targetActorId: ids.removedActor
    },
    maintainedEffectStateId: stateId,
    createdOrdinal: 2,
    version: 1,
    definitionChecksum: 'e'.repeat(64),
    lifecycleChecksum: 'f'.repeat(64)
  }
}
function state(id = ids.state, ownerActorId = ids.removedActor) {
  return {
    id,
    ownerActorId,
    maintenanceDefinitionId: ids.definition,
    descriptorChecksum: 'g'.repeat(64),
    version: 1
  }
}
function encounter() {
  return {
    id: ids.encounter,
    campaignId: ids.campaign,
    actors: [
      {
        id: ids.characterActor,
        kind: 'CHARACTER' as const,
        sourceId: ids.character,
        sourceRevision: 4
      }
    ]
  }
}
function db() {
  return {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          forUpdate: () => ({
            executeTakeFirst: async () => ({
              id: ids.character,
              status: 'ACTIVE',
              stream_version: 4
            })
          })
        })
      })
    })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.locator.mockResolvedValue([])
  mocks.lockStates.mockResolvedValue([])
  mocks.lockByOwner.mockResolvedValue([])
  mocks.lockDependents.mockResolvedValue([])
  mocks.guard.mockResolvedValue(undefined)
  mocks.assignmentIfPresent.mockResolvedValue(true)
  mocks.context.mockResolvedValue({ adjustments: [], attunementSlotOverride: null })
  mocks.mechanics.mockResolvedValue({
    characterStreamVersion: 4,
    projectionChecksum: 'h'.repeat(64),
    commandState: { state: { hitpoints: { current: 5, temp: 0 }, conditions: [] } }
  })
  mocks.overlay.mockResolvedValue({
    campaignId: ids.campaign,
    characterId: ids.character,
    characterStreamVersion: 4,
    projectionChecksum: 'i'.repeat(64),
    kind: 'MATERIALIZED',
    mechanicalContextChecksum: 'a'.repeat(64),
    manualMaximumModifierOwner: null,
    rulePolicyInput: {},
    rulePolicyOutput: {}
  })
  mocks.patch.mockImplementation(async (_characterId, _patches, options) => {
    await options.afterPersist(db() as never, 5)
    return 5
  })
  mocks.deleteEffect.mockResolvedValue(undefined)
  mocks.deleteState.mockResolvedValue(undefined)
})

describe('removed Encounter actor maintained cleanup', () => {
  it('does nothing when no owned state or actor effect exists', async () => {
    await expect(
      cleanupRemovedEncounterActorMaintainedEffects({
        trx: db() as never,
        encounter: encounter() as never,
        removedActorId: ids.removedActor,
        attunementSlotOverride: null
      })
    ).resolves.toMatchObject({ result: null })
    expect(mocks.guard).not.toHaveBeenCalled()
    expect(mocks.deleteEffect).not.toHaveBeenCalled()
    expect(mocks.deleteState).not.toHaveBeenCalled()
  })

  it('does not inspect or remove an independent Character effect sourced by the removed actor', async () => {
    // Independent effects are absent from the maintained-state identity joins.
    // The cleanup has no authority to enumerate or delete them.
    await cleanupRemovedEncounterActorMaintainedEffects({
      trx: db() as never,
      encounter: encounter() as never,
      removedActorId: ids.removedActor,
      attunementSlotOverride: null
    })
    expect(mocks.deleteEffect).not.toHaveBeenCalled()
    expect(mocks.patch).not.toHaveBeenCalled()
  })

  it('locks Character authority before effects and deletes owned mixed dependents once', async () => {
    mocks.locator.mockResolvedValue([ids.character])
    mocks.lockStates.mockResolvedValue([state()])
    mocks.lockDependents
      .mockResolvedValueOnce([characterEffect(), actorEffect()])
      .mockResolvedValueOnce([])
    const result = await cleanupRemovedEncounterActorMaintainedEffects({
      trx: db() as never,
      encounter: encounter() as never,
      removedActorId: ids.removedActor,
      attunementSlotOverride: 3
    })
    expect(mocks.guard.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.lockStates.mock.invocationCallOrder[0]
    )
    expect(mocks.assignmentIfPresent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.lockStates.mock.invocationCallOrder[0]
    )
    expect(mocks.assignmentIfPresent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.lockDependents.mock.invocationCallOrder[0]
    )
    expect(mocks.deleteEffect).toHaveBeenCalledTimes(2)
    expect(mocks.patch).toHaveBeenCalledTimes(1)
    expect(mocks.deleteState).toHaveBeenCalledTimes(1)
    expect(mocks.context).toHaveBeenCalledWith(expect.anything(), ids.character, {
      id: ids.campaign,
      attunementSlotOverride: 3
    })
    expect(mocks.publish).toHaveBeenCalledTimes(1)
    expect(result.result?.characterOwnerTransitions).toEqual([
      { characterId: ids.character, beforeStreamVersion: 4, afterStreamVersion: 5 }
    ])
  })

  it('preserves a foreign maintained state when another dependent remains', async () => {
    mocks.locator.mockResolvedValue([ids.character])
    mocks.lockByOwner.mockResolvedValue([actorEffect(ids.foreignState)])
    mocks.lockState.mockResolvedValue(
      state(ids.foreignState, '00000000-0000-4000-8000-000000000011')
    )
    mocks.lockDependents
      .mockResolvedValueOnce([actorEffect(ids.foreignState), characterEffect()])
      .mockResolvedValueOnce([characterEffect()])
    const result = await cleanupRemovedEncounterActorMaintainedEffects({
      trx: db() as never,
      encounter: encounter() as never,
      removedActorId: ids.removedActor,
      attunementSlotOverride: null
    })
    expect(mocks.deleteEffect).toHaveBeenCalledTimes(1)
    expect(mocks.deleteState).not.toHaveBeenCalled()
    expect(result.result?.removedEffects).toHaveLength(1)
  })

  it('deletes a foreign state only after its final removed actor dependent', async () => {
    mocks.locator.mockResolvedValue([])
    mocks.lockByOwner.mockResolvedValue([actorEffect(ids.foreignState)])
    mocks.lockState.mockResolvedValue(
      state(ids.foreignState, '00000000-0000-4000-8000-000000000011')
    )
    mocks.lockDependents
      .mockResolvedValueOnce([actorEffect(ids.foreignState)])
      .mockResolvedValueOnce([])
    await cleanupRemovedEncounterActorMaintainedEffects({
      trx: db() as never,
      encounter: encounter() as never,
      removedActorId: ids.removedActor,
      attunementSlotOverride: null
    })
    expect(mocks.deleteState).toHaveBeenCalledTimes(1)
  })

  it('fails closed when a locked dependent Character was not located', async () => {
    mocks.lockStates.mockResolvedValue([state()])
    mocks.lockDependents.mockResolvedValue([characterEffect()])
    await expect(
      cleanupRemovedEncounterActorMaintainedEffects({
        trx: db() as never,
        encounter: encounter() as never,
        removedActorId: ids.removedActor,
        attunementSlotOverride: null
      })
    ).rejects.toThrow('Character owner changed')
    expect(mocks.deleteEffect).not.toHaveBeenCalled()
  })

  it('advances a located unassigned Character without requiring or publishing an overlay', async () => {
    mocks.locator.mockResolvedValue([ids.character])
    mocks.assignmentIfPresent.mockResolvedValue(false)
    mocks.lockStates.mockResolvedValue([state()])
    mocks.lockDependents.mockResolvedValueOnce([characterEffect()]).mockResolvedValueOnce([])
    await cleanupRemovedEncounterActorMaintainedEffects({
      trx: db() as never,
      encounter: encounter() as never,
      removedActorId: ids.removedActor,
      attunementSlotOverride: null
    })
    expect(mocks.mechanics).toHaveBeenCalledTimes(1)
    expect(mocks.advance).toHaveBeenCalledTimes(1)
    expect(mocks.context).not.toHaveBeenCalled()
    expect(mocks.overlay).not.toHaveBeenCalled()
    expect(mocks.publish).not.toHaveBeenCalled()
  })
})
