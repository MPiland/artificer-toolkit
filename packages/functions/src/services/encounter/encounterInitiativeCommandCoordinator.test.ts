import { describe, expect, it, vi } from 'vitest'

import type { EncounterRecord } from '@artificer-toolkit/db'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'

const mocks = vi.hoisted(() => ({
  adapter: vi.fn(),
  lockSources: vi.fn()
}))

vi.mock('../rules/initiativeFactAdapterRegistry.js', () => ({
  initiativeFactAdapterRegistry: { get: mocks.adapter }
}))

vi.mock('./encounterInitiativeFactSources.js', () => ({
  lockEncounterInitiativeFactSources: mocks.lockSources
}))

import {
  createStagedInitiativeRoundState,
  resumeEncounterInitiativeCommand,
  startEncounterInitiativeCommand
} from './encounterInitiativeCommandCoordinator.js'

const encounterId = '00000000-0000-4000-8000-000000000001'
const actorA = '00000000-0000-4000-8000-000000000002'
const actorB = '00000000-0000-4000-8000-000000000003'
const systemId = '00000000-0000-4000-8000-000000000004'
const checksum = 'a'.repeat(64)

function policy(
  procedure: 'ACTOR_SCORE' | 'SIDE_ROLL' | 'DECLARED_ACTION_ROLL'
): EncounterInitiativePolicySnapshotDto {
  return {
    policy: { document: { procedure, cadence: 'ENCOUNTER_START' } }
  } as unknown as EncounterInitiativePolicySnapshotDto
}

function encounter(
  procedure: 'ACTOR_SCORE' | 'SIDE_ROLL' | 'DECLARED_ACTION_ROLL'
): EncounterRecord {
  return {
    id: encounterId,
    campaignId: '00000000-0000-4000-8000-000000000005',
    sessionId: '00000000-0000-4000-8000-000000000006',
    gameSystemId: systemId,
    blueprintId: '00000000-0000-4000-8000-000000000007',
    blueprintVersion: 1,
    blueprintChecksum: checksum,
    rulePackRevisionId: null,
    initiativePolicySnapshot: policy(procedure),
    initiativePolicySnapshotChecksum: checksum,
    optionalCombatSnapshot: null,
    optionalCombatSnapshotChecksum: null,
    automationMode: 'MANUAL',
    manualReminderMode: 'OFF',
    name: 'Manual initiative',
    status: 'PREPARED',
    version: 0,
    round: 0,
    currentActorId: null,
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
    actors: [
      { id: actorA, sideId: 'party' },
      { id: actorB, sideId: 'opposition' }
    ],
    reminders: []
  } as unknown as EncounterRecord
}

describe('Encounter initiative command coordinator', () => {
  it('rejects a forged Manual policy resume before resolving policy dependencies', async () => {
    mocks.adapter.mockReset()
    mocks.lockSources.mockReset()
    const current = encounter('ACTOR_SCORE')
    const runtime = { executeResolved: vi.fn(), resume: vi.fn() }
    const integerSource = vi.fn()
    const getEncounterActorSnapshot = vi.fn()

    await expect(
      resumeEncounterInitiativeCommand({
        trx: {} as never,
        repository: {} as never,
        encounter: current,
        round: 1,
        runtime: runtime as never,
        pendingSnapshot: {} as never,
        attunementSlotOverride: null,
        getEncounterActorSnapshot,
        requestId: 'forged-request',
        value: 12,
        integerSource
      })
    ).rejects.toThrow('Manual initiative cannot resume a policy evaluation.')

    expect(mocks.adapter).not.toHaveBeenCalled()
    expect(mocks.lockSources).not.toHaveBeenCalled()
    expect(getEncounterActorSnapshot).not.toHaveBeenCalled()
    expect(runtime.executeResolved).not.toHaveBeenCalled()
    expect(runtime.resume).not.toHaveBeenCalled()
    expect(integerSource).not.toHaveBeenCalled()
  })

  it.each(['ACTOR_SCORE', 'SIDE_ROLL', 'DECLARED_ACTION_ROLL'] as const)(
    'settles Manual %s metadata with the explicit order without policy execution',
    async (procedure) => {
      mocks.adapter.mockReset()
      mocks.lockSources.mockReset()
      const current = encounter(procedure)
      const staged = createStagedInitiativeRoundState({ encounter: current, round: 1 })
      const runtime = { executeResolved: vi.fn(), resume: vi.fn() }
      const integerSource = vi.fn()

      await expect(
        startEncounterInitiativeCommand({
          trx: {} as never,
          repository: {} as never,
          encounter: current,
          round: 1,
          occurrenceId: '00000000-0000-4000-8000-000000000008',
          runtime: runtime as never,
          attunementSlotOverride: null,
          getEncounterActorSnapshot: vi.fn(),
          legacyOrderedActorIds: [actorB, actorA],
          integerSource,
          stagedRoundState: staged
        })
      ).resolves.toMatchObject({
        kind: 'SETTLED',
        orderedActorIds: [actorB, actorA],
        evidence: { primaryResults: [], tieAttempts: [], orderChoices: [] }
      })

      expect(staged.round).toMatchObject({
        procedure: 'MANUAL',
        cadence: 'ENCOUNTER_START',
        policySnapshotChecksum: null
      })
      expect(mocks.adapter).not.toHaveBeenCalled()
      expect(mocks.lockSources).not.toHaveBeenCalled()
      expect(runtime.executeResolved).not.toHaveBeenCalled()
      expect(runtime.resume).not.toHaveBeenCalled()
      expect(integerSource).not.toHaveBeenCalled()
    }
  )
})
