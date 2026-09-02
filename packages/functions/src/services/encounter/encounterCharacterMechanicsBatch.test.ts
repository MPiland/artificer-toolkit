import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  patch: vi.fn(),
  advance: vi.fn(),
  publish: vi.fn(),
  event: vi.fn(),
  updateActor: vi.fn()
}))

vi.mock('@artificer-toolkit/db', () => ({
  createCharacterRepository: () => ({ patchSheetState: state.patch }),
  createCharacterMechanicsProjectionRepository: () => ({
    advanceLiveCommandState: state.advance
  }),
  createCampaignCharacterMechanicsProjectionRepository: () => ({
    publish: state.publish
  }),
  createCharacterEventRepository: () => ({ append: state.event }),
  createEncounterRepository: () => ({ updateActor: state.updateActor })
}))

vi.mock('../character/characterMechanicsCompiler.js', () => ({
  advanceCharacterMechanicsProjectionActionState: ({ current }: { current: unknown }) => current,
  advanceCharacterMechanicsProjectionCommandState: ({ current }: { current: unknown }) => current
}))

vi.mock('../campaign/campaignCharacterMechanicsProjection.js', () => ({
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION: 1,
  compileCampaignCharacterMechanicsProjection: (input: Record<string, unknown>) => ({
    ...input,
    projectionChecksum: 'b'.repeat(64)
  })
}))

vi.mock('@artificer-toolkit/shared/rules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/shared/rules')>()),
  checksumRuleDocument: () => 'c'.repeat(64)
}))

import { EncounterValidationError } from './encounterErrors.js'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterActorRecord } from '@artificer-toolkit/db'

import {
  applyLockedEncounterActorMechanicsBatch,
  applyLockedEncounterCharacterMechanicsBatch,
  deriveEncounterCharacterMechanicsEventCommandId,
  foldCharacterMechanicsApplications
} from './encounterCharacterMechanicsBatch.js'

const actorId = '00000000-0000-4000-8000-000000000001'
const conditionId = '00000000-0000-4000-8000-000000000002'
const damageTypeId = '00000000-0000-4000-8000-000000000003'
const damageOutcomeId = '00000000-0000-4000-8000-000000000004'
const characterId = '00000000-0000-4000-8000-000000000010'

const trace = {
  sourceNodeId: 'effect-node',
  sourceOperationKey: 'effect.apply',
  authoredPath: null,
  resolvedPath: 'ON_USE',
  sourceActiveEffectId: '00000000-0000-4000-8000-000000000005'
}

type BatchInput = Parameters<typeof applyLockedEncounterCharacterMechanicsBatch>[0]

function makeBatchInput(overrides: Partial<BatchInput> = {}): BatchInput {
  const mechanics = {
    characterStreamVersion: 4,
    projectionChecksum: 'a'.repeat(64),
    commandState: {
      state: {
        hitpoints: { current: 10, temp: 0 },
        conditions: [{ conditionTypeId: conditionId, notes: 'keep this note' }]
      }
    }
  } as unknown as CharacterMechanicsProjection
  const targetActor = {
    id: actorId,
    kind: 'CHARACTER',
    sourceId: characterId,
    sourceRevision: 4,
    currentHitPoints: 10,
    tempHitPoints: 0,
    maxHitPoints: 10,
    conditions: [{ conditionTypeId: conditionId, label: 'Pinned', notes: 'mirror note' }]
  } as unknown as EncounterActorRecord
  return {
    trx: {} as BatchInput['trx'],
    actorUserId: '00000000-0000-4000-8000-000000000011',
    encounterId: '00000000-0000-4000-8000-000000000012',
    occurrenceId: '00000000-0000-4000-8000-000000000013',
    commandId: '00000000-0000-4000-8000-000000000015',
    sourceCommandId: '00000000-0000-4000-8000-000000000016',
    targetActor,
    targetCharacterId: characterId,
    mechanics,
    overlay: {
      campaignId: '00000000-0000-4000-8000-000000000014',
      characterId,
      characterStreamVersion: 4,
      baseMechanicsProjectionChecksum: 'a'.repeat(64),
      projectionSchemaVersion: 1,
      projectionChecksum: 'd'.repeat(64),
      mechanicalContextChecksum: 'e'.repeat(64),
      manualMaximumModifierOwner: null,
      kind: 'MATERIALIZED',
      rulePolicyInput: {},
      rulePolicyOutput: {}
    } as BatchInput['overlay'],
    effectiveMaximumHitPoints: 10,
    conditionDefinitions: [{ id: conditionId, label: 'Pinned' }],
    applications: [],
    forceVersionAdvance: false,
    ...overrides
  }
}

beforeEach(() => {
  state.patch.mockReset()
  state.advance.mockReset()
  state.publish.mockReset()
  state.event.mockReset()
  state.updateActor.mockReset()
  state.patch.mockImplementation(async (_id, _patches, options) => {
    await options.afterPersist({}, 5)
    return 5
  })
  state.advance.mockResolvedValue(undefined)
  state.publish.mockResolvedValue(undefined)
  state.event.mockResolvedValue(undefined)
  state.updateActor.mockResolvedValue(undefined)
})

function encounterActor(): EncounterActorRecord {
  return {
    id: actorId,
    kind: 'CREATURE',
    systemId: '00000000-0000-4000-8000-000000000020',
    sourceId: '00000000-0000-4000-8000-000000000021',
    sourceRevision: 1,
    label: 'Test creature',
    maxHitPoints: 10,
    currentHitPoints: 10,
    tempHitPoints: 2,
    conditions: [{ conditionTypeId: conditionId, notes: 'preserve' }]
  } as unknown as EncounterActorRecord
}

function damageApplication() {
  return {
    ...trace,
    kind: 'DAMAGE' as const,
    targetActorId: actorId,
    requestedAmount: 4,
    resolvedAmount: 4,
    appliedAmount: 4,
    beforeCurrentHitPoints: 10,
    afterCurrentHitPoints: 8,
    beforeTemporaryHitPoints: 2,
    afterTemporaryHitPoints: 0,
    maximumHitPoints: 10,
    damageTypeId,
    damageDisposition: 'NORMAL' as const
  }
}

describe('foldCharacterMechanicsApplications', () => {
  it('folds ordered hit-point and condition applications into canonical receipts', () => {
    const result = foldCharacterMechanicsApplications({
      targetActorId: actorId,
      currentHitPoints: 10,
      temporaryHitPoints: 2,
      maximumHitPoints: 12,
      conditionIds: [],
      applications: [
        {
          ...trace,
          kind: 'DAMAGE',
          targetActorId: actorId,
          requestedAmount: 4,
          resolvedAmount: 4,
          appliedAmount: 4,
          beforeCurrentHitPoints: 10,
          afterCurrentHitPoints: 8,
          beforeTemporaryHitPoints: 2,
          afterTemporaryHitPoints: 0,
          maximumHitPoints: 12,
          damageTypeId,
          damageDisposition: 'NORMAL'
        },
        { ...trace, kind: 'CONDITION_APPLY', targetActorId: actorId, conditionId },
        {
          ...trace,
          kind: 'HEAL',
          targetActorId: actorId,
          requestedAmount: 3,
          resolvedAmount: 3,
          appliedAmount: 3,
          beforeCurrentHitPoints: 8,
          afterCurrentHitPoints: 11,
          beforeTemporaryHitPoints: 0,
          afterTemporaryHitPoints: 0,
          maximumHitPoints: 12
        }
      ]
    })

    expect(result.after).toEqual({
      currentHitPoints: 11,
      temporaryHitPoints: 0,
      maximumHitPoints: 12,
      scalarValues: {},
      conditionIds: [conditionId]
    })
    expect(result.applications.map((application) => application.ordinal)).toEqual([0, 1, 2])
    expect(result.stateChanged).toBe(true)
  })

  it('records duplicate conditions as a no-op without changing state', () => {
    const result = foldCharacterMechanicsApplications({
      targetActorId: actorId,
      currentHitPoints: 10,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      conditionIds: [conditionId],
      applications: [{ ...trace, kind: 'CONDITION_APPLY', targetActorId: actorId, conditionId }]
    })

    expect(result.applications[0]).toMatchObject({
      kind: 'CONDITION_APPLY',
      beforePresent: true,
      applied: false
    })
    expect(result.stateChanged).toBe(false)
  })

  it('removes an owned condition and records the terminal condition state', () => {
    const result = foldCharacterMechanicsApplications({
      targetActorId: actorId,
      currentHitPoints: 10,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      conditionIds: [conditionId],
      applications: [{ ...trace, kind: 'CONDITION_REMOVE', targetActorId: actorId, conditionId }]
    })

    expect(result.after.conditionIds).toEqual([])
    expect(result.applications).toEqual([
      expect.objectContaining({
        kind: 'CONDITION_REMOVE',
        beforePresent: true,
        afterPresent: false,
        applied: true
      })
    ])
  })

  it('records a source-bound removal as a no-op while another contribution retains it', () => {
    const result = foldCharacterMechanicsApplications({
      targetActorId: actorId,
      currentHitPoints: 10,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      conditionIds: [conditionId],
      retainedConditionIds: [conditionId],
      applications: [{ ...trace, kind: 'CONDITION_REMOVE', targetActorId: actorId, conditionId }]
    })

    expect(result.after.conditionIds).toEqual([conditionId])
    expect(result.applications).toEqual([
      expect.objectContaining({
        kind: 'CONDITION_REMOVE',
        beforePresent: true,
        afterPresent: true,
        applied: false
      })
    ])
  })

  it('reduces maximum hit points from resolved damage and clamps current hit points', () => {
    const result = foldCharacterMechanicsApplications({
      targetActorId: actorId,
      currentHitPoints: 10,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      conditionIds: [],
      applications: [
        {
          ...trace,
          kind: 'HIT_POINT_MAXIMUM_REDUCTION',
          targetActorId: actorId,
          sourceDamageNodeId: 'damage-node',
          sourceDamageOperationKey: 'dnd5e.damage-proposal',
          sourceDamageOutcomeId: damageOutcomeId,
          reductionAmount: 4,
          recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM']
        }
      ]
    })

    expect(result.after).toMatchObject({ currentHitPoints: 6, maximumHitPoints: 6 })
    expect(result.applications[0]).toMatchObject({
      kind: 'HIT_POINT_MAXIMUM_REDUCTION',
      beforeMaximumHitPoints: 10,
      afterMaximumHitPoints: 6,
      sourceDamageOutcomeId: damageOutcomeId
    })
  })

  it('stacks UUID-backed scalar reductions, clamps at zero, and records terminal hit-point zero', () => {
    const scalarDefinitionId = '00000000-0000-4000-8000-000000000061'
    const result = foldCharacterMechanicsApplications({
      targetActorId: actorId,
      currentHitPoints: 10,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      conditionIds: [],
      scalarValues: { [scalarDefinitionId]: 3 },
      applications: [
        {
          ...trace,
          kind: 'SCALAR_REDUCTION',
          targetActorId: actorId,
          valueDefinitionId: scalarDefinitionId,
          reductionAmount: 1,
          stacking: 'ADDITIVE',
          floor: 0,
          recoveryTriggers: ['SHORT_REST', 'LONG_REST'],
          terminalConsequence: 'TARGET_DIED',
          sourceOutcomeId: damageOutcomeId
        },
        {
          ...trace,
          kind: 'SCALAR_REDUCTION',
          targetActorId: actorId,
          valueDefinitionId: scalarDefinitionId,
          reductionAmount: 4,
          stacking: 'ADDITIVE',
          floor: 0,
          recoveryTriggers: ['SHORT_REST', 'LONG_REST'],
          terminalConsequence: 'TARGET_DIED',
          sourceOutcomeId: '00000000-0000-4000-8000-000000000062'
        }
      ]
    })

    expect(result.before.scalarValues).toEqual({ [scalarDefinitionId]: 3 })
    expect(result.after).toMatchObject({
      currentHitPoints: 0,
      scalarValues: { [scalarDefinitionId]: 0 }
    })
    expect(result.applications).toMatchObject([
      { kind: 'SCALAR_REDUCTION', beforeValue: 3, afterValue: 2, targetDied: false },
      { kind: 'SCALAR_REDUCTION', beforeValue: 2, afterValue: 0, targetDied: true }
    ])
  })

  it('rejects stale hit-point chaining before persistence', () => {
    expect(() =>
      foldCharacterMechanicsApplications({
        targetActorId: actorId,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        conditionIds: [],
        applications: [
          {
            ...trace,
            kind: 'HEAL',
            targetActorId: actorId,
            requestedAmount: 1,
            resolvedAmount: 1,
            appliedAmount: 1,
            beforeCurrentHitPoints: 9,
            afterCurrentHitPoints: 10,
            beforeTemporaryHitPoints: 0,
            afterTemporaryHitPoints: 0,
            maximumHitPoints: 10
          }
        ]
      })
    ).toThrow(EncounterValidationError)
  })

  it('rejects under-applied healing and damage before persistence', () => {
    const base = {
      targetActorId: actorId,
      currentHitPoints: 8,
      temporaryHitPoints: 2,
      maximumHitPoints: 10,
      conditionIds: []
    }
    expect(() =>
      foldCharacterMechanicsApplications({
        ...base,
        applications: [
          {
            ...trace,
            kind: 'HEAL',
            targetActorId: actorId,
            requestedAmount: 3,
            resolvedAmount: 3,
            appliedAmount: 1,
            beforeCurrentHitPoints: 8,
            afterCurrentHitPoints: 9,
            beforeTemporaryHitPoints: 2,
            afterTemporaryHitPoints: 2,
            maximumHitPoints: 10
          }
        ]
      })
    ).toThrow(EncounterValidationError)
    expect(() =>
      foldCharacterMechanicsApplications({
        ...base,
        applications: [
          {
            ...trace,
            kind: 'DAMAGE',
            targetActorId: actorId,
            requestedAmount: 4,
            resolvedAmount: 4,
            appliedAmount: 4,
            beforeCurrentHitPoints: 8,
            afterCurrentHitPoints: 4,
            beforeTemporaryHitPoints: 2,
            afterTemporaryHitPoints: 2,
            maximumHitPoints: 10,
            damageTypeId,
            damageDisposition: 'NORMAL'
          }
        ]
      })
    ).toThrow(EncounterValidationError)
  })

  it('uses the established temporary-hit-point replacement arithmetic', () => {
    const result = foldCharacterMechanicsApplications({
      targetActorId: actorId,
      currentHitPoints: 8,
      temporaryHitPoints: 2,
      maximumHitPoints: 10,
      conditionIds: [],
      applications: [
        {
          ...trace,
          kind: 'TEMPORARY_HIT_POINTS',
          targetActorId: actorId,
          requestedAmount: 5,
          resolvedAmount: 5,
          appliedAmount: 3,
          beforeCurrentHitPoints: 8,
          afterCurrentHitPoints: 8,
          beforeTemporaryHitPoints: 2,
          afterTemporaryHitPoints: 5,
          maximumHitPoints: 10
        }
      ]
    })
    expect(result.after.temporaryHitPoints).toBe(5)
    expect(() =>
      foldCharacterMechanicsApplications({
        targetActorId: actorId,
        currentHitPoints: 8,
        temporaryHitPoints: 2,
        maximumHitPoints: 10,
        conditionIds: [],
        applications: [
          {
            ...trace,
            kind: 'TEMPORARY_HIT_POINTS',
            targetActorId: actorId,
            requestedAmount: 5,
            resolvedAmount: 5,
            appliedAmount: 5,
            beforeCurrentHitPoints: 8,
            afterCurrentHitPoints: 8,
            beforeTemporaryHitPoints: 2,
            afterTemporaryHitPoints: 7,
            maximumHitPoints: 10
          }
        ]
      })
    ).toThrow(EncounterValidationError)
  })
})

describe('applyLockedEncounterCharacterMechanicsBatch', () => {
  it('derives stable, phase-separated child command identities', () => {
    const base = {
      occurrenceId: '00000000-0000-4000-8000-000000000013',
      sourceCommandId: '00000000-0000-4000-8000-000000000016',
      ordinal: 0,
      targetCharacterId: characterId
    }
    const reaction = deriveEncounterCharacterMechanicsEventCommandId({
      ...base,
      phase: 'MOVEMENT_REACTION_OUTCOME'
    })
    const spatial = deriveEncounterCharacterMechanicsEventCommandId({
      ...base,
      phase: 'SPATIAL_EFFECT'
    })

    expect(reaction).toBe(
      deriveEncounterCharacterMechanicsEventCommandId({
        ...base,
        phase: 'MOVEMENT_REACTION_OUTCOME'
      })
    )
    expect(reaction).not.toBe(spatial)
  })

  it('force-advances once without an outcome event and preserves condition details', async () => {
    await applyLockedEncounterCharacterMechanicsBatch(makeBatchInput({ forceVersionAdvance: true }))

    expect(state.patch).toHaveBeenCalledTimes(1)
    expect(state.advance).toHaveBeenCalledTimes(1)
    expect(state.publish).toHaveBeenCalledTimes(1)
    expect(state.event).not.toHaveBeenCalled()
    const patches = state.patch.mock.calls[0]?.[1] as Array<{ kind: string; value: unknown }>
    expect(patches.find((patch) => patch.kind === 'CONDITIONS')?.value).toEqual([
      { conditionTypeId: conditionId, notes: 'keep this note' }
    ])
  })

  it('commits a sealed terminal spell-slot transition exactly once', async () => {
    await applyLockedEncounterCharacterMechanicsBatch(
      makeBatchInput({
        forceVersionAdvance: true,
        spellSlotUsage: [{ slotKey: 'STANDARD:1', used: 1 }]
      })
    )

    expect(state.patch).toHaveBeenCalledTimes(1)
    const patches = state.patch.mock.calls[0]?.[1] as Array<{ kind: string; value: unknown }>
    expect(patches.find((patch) => patch.kind === 'SPELL_SLOTS')?.value).toEqual([
      { slotKey: 'STANDARD:1', used: 1 }
    ])
  })

  it('does not write an empty non-forced batch', async () => {
    const result = await applyLockedEncounterCharacterMechanicsBatch(makeBatchInput())

    expect(result.streamVersion).toBeNull()
    expect(state.patch).not.toHaveBeenCalled()
    expect(state.advance).not.toHaveBeenCalled()
    expect(state.publish).not.toHaveBeenCalled()
    expect(state.event).not.toHaveBeenCalled()
  })

  it('uses the exact child command identity for a Character outcome event', async () => {
    const commandId = '00000000-0000-4000-8000-000000000017'
    await applyLockedEncounterCharacterMechanicsBatch(
      makeBatchInput({
        commandId,
        applications: [
          {
            ...damageApplication(),
            beforeTemporaryHitPoints: 0,
            afterTemporaryHitPoints: 0,
            afterCurrentHitPoints: 6
          }
        ]
      })
    )

    expect(state.event).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId,
        sourceCommandId: '00000000-0000-4000-8000-000000000016',
        occurrenceId: '00000000-0000-4000-8000-000000000013'
      })
    )
  })

  it('records the retained condition state truthfully in Character history', async () => {
    await applyLockedEncounterCharacterMechanicsBatch(
      makeBatchInput({
        retainedConditionIds: [conditionId],
        applications: [
          {
            ...trace,
            kind: 'TEMPORARY_HIT_POINTS',
            targetActorId: actorId,
            requestedAmount: 1,
            resolvedAmount: 1,
            appliedAmount: 1,
            beforeCurrentHitPoints: 10,
            afterCurrentHitPoints: 10,
            beforeTemporaryHitPoints: 0,
            afterTemporaryHitPoints: 1,
            maximumHitPoints: 10
          },
          { ...trace, kind: 'CONDITION_REMOVE', targetActorId: actorId, conditionId }
        ]
      })
    )

    expect(state.event).toHaveBeenCalledWith(
      expect.objectContaining({
        applications: expect.arrayContaining([
          expect.objectContaining({
            outcome: 'CONDITION_REMOVE',
            conditionId,
            beforePresent: true,
            afterPresent: true,
            applied: false
          })
        ])
      })
    )
  })

  it('requires a pinned definition before any write', async () => {
    await expect(
      applyLockedEncounterCharacterMechanicsBatch(
        makeBatchInput({
          conditionDefinitions: [],
          applications: [
            {
              ...trace,
              kind: 'CONDITION_APPLY',
              targetActorId: actorId,
              conditionId: '00000000-0000-4000-8000-000000000015'
            }
          ]
        })
      )
    ).rejects.toThrow('condition definition')
    expect(state.patch).not.toHaveBeenCalled()
  })

  it('rejects missing or extra Character condition identities in the actor mirror', async () => {
    const application = {
      ...trace,
      kind: 'CONDITION_APPLY' as const,
      targetActorId: actorId,
      conditionId
    }
    const missing = makeBatchInput({ applications: [application] })
    missing.targetActor = { ...missing.targetActor, conditions: [] }
    await expect(applyLockedEncounterCharacterMechanicsBatch(missing)).rejects.toThrow(
      'condition mirror'
    )
    const extra = makeBatchInput({ applications: [application] })
    extra.targetActor = {
      ...extra.targetActor,
      conditions: [
        { conditionTypeId: conditionId, label: 'Pinned', notes: 'mirror note' },
        {
          conditionTypeId: '00000000-0000-4000-8000-000000000016',
          label: 'Unexpected'
        }
      ]
    }
    await expect(applyLockedEncounterCharacterMechanicsBatch(extra)).rejects.toThrow(
      'condition mirror'
    )
    expect(state.patch).not.toHaveBeenCalled()
  })
})

describe('applyLockedEncounterActorMechanicsBatch', () => {
  it('does not write an unchanged non-Character target and returns its exact receipt transition', async () => {
    const targetActor = encounterActor()
    const result = await applyLockedEncounterActorMechanicsBatch({
      trx: {} as never,
      targetActor,
      initialConditionRows: targetActor.conditions ?? [],
      applications: [{ ...trace, kind: 'CONDITION_APPLY', targetActorId: actorId, conditionId }]
    })

    expect(state.updateActor).not.toHaveBeenCalled()
    expect(result.stateChanged).toBe(false)
    expect(result.targetTransition).toMatchObject({
      before: { currentHitPoints: 10, temporaryHitPoints: 2, conditionIds: [conditionId] },
      after: { currentHitPoints: 10, temporaryHitPoints: 2, conditionIds: [conditionId] }
    })
    expect(result.receiptApplications).toMatchObject([
      { ordinal: 0, kind: 'CONDITION_APPLY', beforePresent: true, applied: false }
    ])
  })

  it('applies damage and a new condition once while preserving prior condition rows', async () => {
    const targetActor = encounterActor()
    const addedConditionId = '00000000-0000-4000-8000-000000000022'
    const result = await applyLockedEncounterActorMechanicsBatch({
      trx: {} as never,
      targetActor,
      initialConditionRows: targetActor.conditions ?? [],
      applications: [
        damageApplication(),
        { ...trace, kind: 'CONDITION_APPLY', targetActorId: actorId, conditionId: addedConditionId }
      ]
    })

    expect(state.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: actorId,
        currentHitPoints: 8,
        tempHitPoints: 0,
        conditions: [
          { conditionTypeId: conditionId, notes: 'preserve' },
          { conditionTypeId: addedConditionId }
        ]
      })
    )
    expect(result.targetTransition.after).toEqual({
      currentHitPoints: 8,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      scalarValues: {},
      conditionIds: [conditionId, addedConditionId]
    })
    expect(result.receiptApplications.map((application) => application.ordinal)).toEqual([0, 1])
  })

  it('rejects stale condition rows and a mismatched target before an Encounter actor write', async () => {
    const targetActor = encounterActor()
    await expect(
      applyLockedEncounterActorMechanicsBatch({
        trx: {} as never,
        targetActor,
        initialConditionRows: [{ conditionTypeId: 'not-a-uuid' }],
        applications: []
      })
    ).rejects.toThrow('conditions are not canonical')
    await expect(
      applyLockedEncounterActorMechanicsBatch({
        trx: {} as never,
        targetActor,
        initialConditionRows: [],
        applications: []
      })
    ).rejects.toThrow('conditions are stale')
    await expect(
      applyLockedEncounterActorMechanicsBatch({
        trx: {} as never,
        targetActor,
        initialConditionRows: targetActor.conditions ?? [],
        applications: [
          { ...damageApplication(), targetActorId: '00000000-0000-4000-8000-000000000023' }
        ]
      })
    ).rejects.toThrow(EncounterValidationError)
    expect(state.updateActor).not.toHaveBeenCalled()
  })
})
