import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EncounterActorRecord } from '@artificer-toolkit/db'

const state = vi.hoisted(() => ({
  assertCurrentFeature: vi.fn(),
  applyActor: vi.fn(),
  applyCharacter: vi.fn(),
  compileFeature: vi.fn(),
  persistResource: vi.fn(),
  updateActor: vi.fn()
}))

vi.mock('../rules/encounterFeatureActionCapabilityDiscovery.js', () => ({
  assertEncounterFeatureActionCapabilityCurrent: state.assertCurrentFeature
}))

vi.mock('../rules/characterRuleActionSystemAdapterRegistry.js', () => ({
  characterRuleActionSystemAdapterRegistry: {
    get: () => ({ compile: state.compileFeature })
  }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createEncounterRepository: () => ({ updateActor: state.updateActor })
}))

vi.mock('./encounterCharacterMechanicsBatch.js', () => ({
  applyLockedEncounterActorMechanicsBatch: state.applyActor,
  applyLockedEncounterCharacterMechanicsBatch: state.applyCharacter,
  deriveEncounterCharacterMechanicsEventCommandId: ({
    sourceCommandId,
    phase,
    ordinal
  }: {
    sourceCommandId: string
    phase: string
    ordinal: number
  }) => `${sourceCommandId}:${phase}:${ordinal}`,
  readEncounterActorConditionState: (value: unknown) => ({
    ids: Array.isArray(value)
      ? value.flatMap((entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          'conditionTypeId' in entry &&
          typeof entry.conditionTypeId === 'string'
            ? [entry.conditionTypeId]
            : []
        )
      : [],
    values: Array.isArray(value) ? value : []
  })
}))

vi.mock('./encounterCharacterActionResource.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./encounterCharacterActionResource.js')>()),
  persistEncounterCharacterActionResourceConsumption: state.persistResource
}))

import type { PreparedEncounterMovementReactionSettlement } from './encounterMovementReactionActionSettlement.js'
import { settleEncounterActionSettlementCore } from './encounterActionSettlementCore.js'
import {
  prepareEncounterMovementReactionSettlement,
  settleEncounterMovementReactionAction
} from './encounterMovementReactionActionSettlement.js'

type LockedTargetCharacter =
  PreparedEncounterMovementReactionSettlement['targets']['lockedCharacters'] extends ReadonlyMap<
    string,
    infer Value
  >
    ? Value
    : never

const ids = {
  actor: '00000000-0000-4000-8000-000000000201',
  allowance: '00000000-0000-4000-8000-000000000202',
  character: '00000000-0000-4000-8000-000000000203',
  encounter: '00000000-0000-4000-8000-000000000204',
  occurrence: '00000000-0000-4000-8000-000000000205',
  feature: '00000000-0000-4000-8000-000000000216',
  featureCharge: 'feature-charge',
  target: '00000000-0000-4000-8000-000000000206',
  user: '00000000-0000-4000-8000-000000000207'
}

const transition = {
  checksum: 'a'.repeat(64),
  before: {
    currentHitPoints: 10,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    conditionIds: []
  },
  after: {
    currentHitPoints: 6,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    conditionIds: []
  }
}

const receiptApplication = {
  ordinal: 0,
  kind: 'DAMAGE' as const,
  requestedAmount: 4,
  resolvedAmount: 4,
  appliedAmount: 4,
  beforeCurrentHitPoints: 10,
  afterCurrentHitPoints: 6,
  beforeTemporaryHitPoints: 0,
  afterTemporaryHitPoints: 0,
  maximumHitPoints: 10,
  damageTypeId: '00000000-0000-4000-8000-000000000208',
  damageDisposition: 'NORMAL' as const,
  sourceNodeId: 'damage',
  sourceOperationKey: 'test.damage',
  authoredPath: 'ON_HIT',
  resolvedPath: 'ON_HIT'
}

function actor(input: {
  id: string
  kind: 'CHARACTER' | 'CREATURE'
  sourceId?: string
}): EncounterActorRecord {
  return {
    id: input.id,
    encounterId: ids.encounter,
    kind: input.kind,
    sourceId: input.sourceId ?? null,
    sourceRevision: input.kind === 'CHARACTER' ? 4 : 1,
    systemId: '00000000-0000-4000-8000-000000000209',
    label: input.kind,
    stableTieKey: input.id,
    public: true,
    maxHitPoints: 10,
    currentHitPoints: 10,
    tempHitPoints: 0,
    conditions: [],
    resources: {},
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    snapshot: {},
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z'
  }
}

function prepared(
  resourceConsumption: PreparedEncounterMovementReactionSettlement['resourceConsumption'] = null
): PreparedEncounterMovementReactionSettlement {
  const sourceActor = actor({
    id: ids.actor,
    kind: 'CHARACTER',
    sourceId: ids.character
  })
  const targetActor = actor({ id: ids.target, kind: 'CREATURE' })
  return {
    action: {} as PreparedEncounterMovementReactionSettlement['action'],
    actionSource: {
      kind: 'CHARACTER_ACTION',
      actorId: ids.actor,
      characterId: ids.character
    } as PreparedEncounterMovementReactionSettlement['actionSource'],
    option: {
      optionId: 'b'.repeat(64)
    } as PreparedEncounterMovementReactionSettlement['option'],
    movementInterruption: null,
    sourceActor,
    targetActor,
    targets: {
      characterIds: [ids.character],
      encounterActorIds: [ids.target],
      lockedCharacters: new Map([
        [
          ids.character,
          {
            id: ids.character,
            systemId: sourceActor.systemId!,
            streamVersion: 4,
            actor: sourceActor,
            mechanics: {} as LockedTargetCharacter['mechanics'],
            overlay: {} as LockedTargetCharacter['overlay'],
            maximumHitPoints: 10,
            conditionDefinitions: [],
            activeConditionDefinitionIds: []
          }
        ]
      ]),
      encounterActors: new Map([[ids.target, targetActor]]),
      encounterActorRules: null
    },
    resourceConsumption,
    featureResourceConsumption: null,
    targetFeatureResourceConsumption: null,
    allowance: {
      definitionId: ids.allowance,
      maximum: 1,
      beforeUsed: 0,
      afterUsed: 1
    }
  }
}

function featureActionSource(actorId = ids.actor) {
  return {
    kind: 'ENCOUNTER_FEATURE' as const,
    actorId,
    capability: {
      kind: 'ENCOUNTER_FEATURE',
      encounterActorId: actorId,
      gameSystemId: '00000000-0000-4000-8000-000000000209',
      compiledEffect: {
        invocation: {
          kind: 'ACTION',
          shape: null,
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
          resourceUse: null
        }
      },
      mechanicFacts: {
        invocation: {
          triggerCode: 'MELEE_WEAPON_ATTACK',
          activation: { code: 'REACTION', amount: 1 },
          savingThrow: null
        },
        outcomes: []
      },
      effectId: '00000000-0000-4000-8000-000000000212',
      ownerFeatureId: ids.feature,
      featureResourceUse: null
    }
  } as unknown as PreparedEncounterMovementReactionSettlement['actionSource']
}

function featureResourceConsumption() {
  return {
    ownerFeatureId: ids.feature,
    chargeId: ids.featureCharge,
    cost: 1,
    beforeUsed: 0,
    afterUsed: 1,
    beforeRemaining: 2,
    afterRemaining: 1
  } as NonNullable<PreparedEncounterMovementReactionSettlement['featureResourceConsumption']>
}

function preparedFeature(
  targetActor = actor({ id: ids.target, kind: 'CREATURE' })
): PreparedEncounterMovementReactionSettlement {
  const sourceActor = actor({ id: ids.actor, kind: 'CREATURE' })
  return {
    action: {} as PreparedEncounterMovementReactionSettlement['action'],
    actionSource: featureActionSource(),
    option: { optionId: 'b'.repeat(64) } as PreparedEncounterMovementReactionSettlement['option'],
    movementInterruption: null,
    sourceActor,
    targetActor,
    targets: {
      characterIds: [],
      encounterActorIds: [ids.actor, targetActor.id],
      lockedCharacters: new Map(),
      encounterActors: new Map([
        [ids.actor, sourceActor],
        [targetActor.id, targetActor]
      ]),
      encounterActorRules: null
    },
    resourceConsumption: null,
    featureResourceConsumption: null,
    targetFeatureResourceConsumption: null,
    allowance: {
      definitionId: ids.allowance,
      maximum: 1,
      beforeUsed: 0,
      afterUsed: 1
    }
  }
}

function execution() {
  return {
    kind: 'COMPLETE' as const,
    execution: {
      status: 'COMPLETE',
      outputs: {},
      evidence: { trace: [] },
      movementInterruption: null
    },
    applications: [],
    d20: null
  } as unknown as Parameters<typeof settleEncounterMovementReactionAction>[0]['execution']
}

beforeEach(() => {
  vi.clearAllMocks()
  state.assertCurrentFeature.mockReturnValue(undefined)
  state.compileFeature.mockReturnValue({
    id: '00000000-0000-4000-8000-000000000212',
    checksum: 'a'.repeat(64)
  })
  state.updateActor.mockResolvedValue(undefined)
  state.persistResource.mockResolvedValue(undefined)
  state.applyActor.mockResolvedValue({
    updatedActor: { ...actor({ id: ids.target, kind: 'CREATURE' }), currentHitPoints: 6 },
    receiptApplications: [receiptApplication],
    targetTransition: transition,
    stateChanged: true
  })
})

describe('Encounter movement reaction action settlement', () => {
  it('rejects a movement interruption outside the movement settlement entry point', async () => {
    const value = execution()
    value.execution = {
      ...value.execution,
      movementInterruption: { kind: 'STOP' }
    }

    await expect(
      settleEncounterActionSettlementCore({
        db: {} as never,
        actorUserId: ids.user,
        encounterId: ids.encounter,
        occurrenceId: ids.occurrence,
        commandId: '00000000-0000-4000-8000-000000000220',
        ordinal: 0,
        eventPhases: {
          resource: 'MOVEMENT_REACTION_RESOURCE',
          outcome: 'MOVEMENT_REACTION_OUTCOME'
        },
        prepared: prepared(),
        execution: value
      })
    ).rejects.toThrow('Movement interruption is unavailable')

    expect(state.applyActor).not.toHaveBeenCalled()
    expect(state.updateActor).not.toHaveBeenCalled()
  })

  it('applies a non-Character target outcome and consumes one allowance', async () => {
    const value = await settleEncounterMovementReactionAction({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000210',
      ordinal: 0,
      prepared: prepared(),
      execution: execution()
    })

    expect(value.application).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      targetActorId: ids.target,
      sourceCharacterStreamVersion: null,
      applications: [{ ordinal: 0, kind: 'DAMAGE' }]
    })
    expect(value.reactionExecution).toMatchObject({
      ordinal: 0,
      allowance: { beforeUsed: 0, afterUsed: 1 }
    })
    expect(state.applyCharacter).not.toHaveBeenCalled()
    expect(state.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ids.actor,
        resources: { ruleUsage: { [ids.allowance]: 1 } }
      })
    )
  })

  it('persists the authored action cost before applying the target and allowance', async () => {
    const resource = {
      poolId: 'pool',
      chargeId: 'charge',
      cost: 1,
      owner: {
        kind: 'AUTHORED_GRANT' as const,
        resourceGrantId: 'grant'
      },
      usageId: 'usage',
      beforeUsed: 0,
      afterUsed: 1,
      beforeRemaining: 2,
      afterRemaining: 1,
      nextBaseState: { facts: {}, output: {} },
      nextOverlayState: null
    } as PreparedEncounterMovementReactionSettlement['resourceConsumption']
    state.applyCharacter.mockImplementation(async (input) => {
      await input.afterPersist({ db: {}, streamVersion: 5 })
      return {
        updatedActor: {
          ...actor({
            id: ids.actor,
            kind: 'CHARACTER',
            sourceId: ids.character
          }),
          sourceRevision: 5
        },
        streamVersion: 5,
        finalState: transition.before,
        receiptApplications: [],
        targetTransition: {
          ...transition,
          after: transition.before
        },
        stateChanged: false
      }
    })

    const value = await settleEncounterMovementReactionAction({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000211',
      ordinal: 0,
      prepared: prepared(resource),
      execution: execution()
    })

    expect(value.application).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      sourceCharacterStreamVersion: 5,
      resourceConsumption: {
        beforeUsed: 0,
        afterUsed: 1,
        beforeRemaining: 2,
        afterRemaining: 1
      }
    })
    expect(state.persistResource).toHaveBeenCalledTimes(1)
    expect(state.applyCharacter).toHaveBeenCalledBefore(state.applyActor)
    expect(state.applyActor).toHaveBeenCalledBefore(state.updateActor)
    expect(state.applyCharacter).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: '00000000-0000-4000-8000-000000000211:MOVEMENT_REACTION_RESOURCE:0',
        sourceCommandId: '00000000-0000-4000-8000-000000000211'
      })
    )
  })

  it('prepares an immutable Feature through the shared System adapter with locked actor facts', async () => {
    const sourceActor = actor({ id: ids.actor, kind: 'CREATURE' })
    const targetActor = actor({ id: ids.target, kind: 'CREATURE' })
    const actionSource = featureActionSource()
    const value = await prepareEncounterMovementReactionSettlement({
      db: {} as never,
      actorUserId: ids.user,
      automationMode: 'AUTOMATIC',
      encounter: { actors: [sourceActor, targetActor] } as never,
      option: {
        candidate: { movingActorId: ids.target },
        binding: { movementInterruption: null },
        policy: { allowanceDefinitionId: ids.allowance, allowanceMaximum: 1 }
      } as never,
      actionSource,
      targets: {
        characterIds: [],
        encounterActorIds: [ids.actor, ids.target],
        lockedCharacters: new Map(),
        encounterActors: new Map([
          [ids.actor, sourceActor],
          [ids.target, targetActor]
        ]),
        encounterActorRules: {
          actors: [
            {
              actorId: ids.actor,
              initiativeModifier: 2,
              targetProtection: { status: 'NORMALIZED', defenses: [], conditionImmunityIds: [] },
              featureResources: []
            },
            {
              actorId: ids.target,
              initiativeModifier: 0,
              targetProtection: { status: 'NORMALIZED', defenses: [], conditionImmunityIds: [] },
              featureResources: []
            }
          ]
        }
      }
    })

    expect(state.assertCurrentFeature).toHaveBeenCalledWith({
      actor: sourceActor,
      capability: (actionSource as Extract<typeof actionSource, { kind: 'ENCOUNTER_FEATURE' }>)
        .capability
    })
    expect(state.compileFeature).toHaveBeenCalledWith({
      action: expect.objectContaining({ kind: 'ENCOUNTER_FEATURE', encounterActorId: ids.actor })
    })
    expect(value.action.sourceDerivedFacts).toMatchObject({
      actorId: ids.actor,
      initiativeModifier: 2
    })
    expect(value.resourceConsumption).toBeNull()
  })

  it('rejects an immutable Feature action before outcomes when its exact charge has no remaining use', async () => {
    const sourceActor = {
      ...actor({ id: ids.actor, kind: 'CREATURE' }),
      resources: { featureCharges: { [ids.feature]: 1 } }
    }
    const targetActor = actor({ id: ids.target, kind: 'CREATURE' })
    const actionSource = featureActionSource()
    ;(
      actionSource as { capability: { featureResourceUse: unknown } }
    ).capability.featureResourceUse = {
      chargeId: ids.featureCharge,
      cost: 1
    }

    await expect(
      prepareEncounterMovementReactionSettlement({
        db: {} as never,
        actorUserId: ids.user,
        automationMode: 'AUTOMATIC',
        encounter: { actors: [sourceActor, targetActor] } as never,
        option: {
          candidate: { movingActorId: ids.target },
          policy: { allowanceDefinitionId: ids.allowance, allowanceMaximum: 1 }
        } as never,
        actionSource,
        targets: {
          characterIds: [],
          encounterActorIds: [ids.actor, ids.target],
          lockedCharacters: new Map(),
          encounterActors: new Map([
            [ids.actor, sourceActor],
            [ids.target, targetActor]
          ]),
          encounterActorRules: {
            actors: [
              {
                actorId: ids.actor,
                initiativeModifier: 2,
                targetProtection: { status: 'NORMALIZED', defenses: [], conditionImmunityIds: [] },
                featureResources: [
                  {
                    featureId: ids.feature,
                    maximum: 1,
                    reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
                    rawUsed: 1,
                    used: 1,
                    remaining: 0,
                    resetKind: 'DAILY'
                  }
                ]
              },
              {
                actorId: ids.target,
                initiativeModifier: 0,
                targetProtection: { status: 'NORMALIZED', defenses: [], conditionImmunityIds: [] },
                featureResources: []
              }
            ]
          }
        }
      })
    ).rejects.toThrow('resource is unavailable')
    expect(state.applyActor).not.toHaveBeenCalled()
  })

  it('rejects a stale immutable Feature binding before resource or outcome mutation', async () => {
    state.assertCurrentFeature.mockImplementation(() => {
      throw new Error('binding changed')
    })
    const sourceActor = actor({ id: ids.actor, kind: 'CREATURE' })
    const targetActor = actor({ id: ids.target, kind: 'CREATURE' })

    await expect(
      prepareEncounterMovementReactionSettlement({
        db: {} as never,
        actorUserId: ids.user,
        automationMode: 'AUTOMATIC',
        encounter: { actors: [sourceActor, targetActor] } as never,
        option: {
          candidate: { movingActorId: ids.target },
          policy: { allowanceDefinitionId: ids.allowance, allowanceMaximum: 1 }
        } as never,
        actionSource: featureActionSource(),
        targets: {
          characterIds: [],
          encounterActorIds: [ids.actor, ids.target],
          lockedCharacters: new Map(),
          encounterActors: new Map([
            [ids.actor, sourceActor],
            [ids.target, targetActor]
          ]),
          encounterActorRules: {
            actors: [
              {
                actorId: ids.actor,
                initiativeModifier: 2,
                targetProtection: { status: 'NORMALIZED', defenses: [], conditionImmunityIds: [] },
                featureResources: []
              },
              {
                actorId: ids.target,
                initiativeModifier: 0,
                targetProtection: { status: 'NORMALIZED', defenses: [], conditionImmunityIds: [] },
                featureResources: []
              }
            ]
          }
        }
      })
    ).rejects.toThrow('binding changed')
    expect(state.applyActor).not.toHaveBeenCalled()
  })

  it('settles an immutable Feature against a non-Character target without Character resource mutation', async () => {
    const value = await settleEncounterMovementReactionAction({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000213',
      ordinal: 0,
      prepared: preparedFeature(),
      execution: execution()
    })

    expect(value.application).toMatchObject({ kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH' })
    expect(state.applyCharacter).not.toHaveBeenCalled()
    expect(state.persistResource).not.toHaveBeenCalled()
    expect(state.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ids.actor,
        resources: { ruleUsage: { [ids.allowance]: 1 } }
      })
    )
  })

  it('advances an immutable Feature charge exactly once after the target outcome settles', async () => {
    const value = preparedFeature()
    value.featureResourceConsumption = featureResourceConsumption()
    value.sourceActor = {
      ...value.sourceActor,
      resources: { featureCharges: { [ids.feature]: 0 } }
    }
    state.applyActor.mockResolvedValue({
      updatedActor: { ...value.targetActor, currentHitPoints: 6 },
      receiptApplications: [receiptApplication],
      targetTransition: transition,
      stateChanged: true
    })

    const settled = await settleEncounterActionSettlementCore({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000217',
      ordinal: 0,
      eventPhases: { resource: 'MOVEMENT_REACTION_RESOURCE', outcome: 'MOVEMENT_REACTION_OUTCOME' },
      prepared: value,
      execution: execution()
    })

    expect(state.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ids.actor,
        resources: { featureCharges: { [ids.feature]: 1 } }
      })
    )
    expect(settled.application).toMatchObject({
      featureResourceConsumption: {
        ownerActorId: ids.actor,
        ownerFeatureId: ids.feature,
        chargeId: ids.featureCharge,
        beforeUsed: 0,
        afterUsed: 1
      }
    })
  })

  it('keeps both a self-targeted Feature outcome and its charge mutation', async () => {
    const sourceActor = actor({ id: ids.actor, kind: 'CREATURE' })
    const value = preparedFeature(sourceActor)
    value.featureResourceConsumption = featureResourceConsumption()
    value.sourceActor = { ...sourceActor, resources: { featureCharges: { [ids.feature]: 0 } } }
    value.targetActor = value.sourceActor
    state.applyActor.mockResolvedValue({
      updatedActor: { ...value.sourceActor, currentHitPoints: 6 },
      receiptApplications: [receiptApplication],
      targetTransition: transition,
      stateChanged: true
    })

    const settled = await settleEncounterActionSettlementCore({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000218',
      ordinal: 0,
      eventPhases: { resource: 'MOVEMENT_REACTION_RESOURCE', outcome: 'MOVEMENT_REACTION_OUTCOME' },
      prepared: value,
      execution: execution()
    })

    expect(state.applyActor).toHaveBeenCalledWith(
      expect.objectContaining({ targetActor: expect.objectContaining({ id: ids.actor }) })
    )
    expect(state.updateActor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: ids.actor,
        currentHitPoints: 6,
        resources: { featureCharges: { [ids.feature]: 1 } }
      })
    )
    expect(settled.application).toMatchObject({
      featureResourceConsumption: {
        ownerActorId: ids.actor,
        ownerFeatureId: ids.feature,
        afterRemaining: 1
      }
    })
  })

  it('settles both source arms in the generic core without consuming a reaction allowance', async () => {
    for (const value of [prepared(), preparedFeature()]) {
      vi.clearAllMocks()
      state.updateActor.mockResolvedValue(undefined)
      state.applyActor.mockResolvedValue({
        updatedActor: { ...actor({ id: ids.target, kind: 'CREATURE' }), currentHitPoints: 6 },
        receiptApplications: [receiptApplication],
        targetTransition: transition,
        stateChanged: true
      })
      const settled = await settleEncounterActionSettlementCore({
        db: {} as never,
        actorUserId: ids.user,
        encounterId: ids.encounter,
        occurrenceId: ids.occurrence,
        commandId: '00000000-0000-4000-8000-000000000215',
        ordinal: 0,
        eventPhases: {
          resource: 'MOVEMENT_REACTION_RESOURCE',
          outcome: 'MOVEMENT_REACTION_OUTCOME'
        },
        prepared: value,
        execution: execution()
      })
      expect(settled.application).toMatchObject({ kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH' })
      expect(settled.sourceActor.id).toBe(ids.actor)
      expect(state.updateActor).not.toHaveBeenCalled()
    }
  })

  it('settles an immutable Feature against a locked Character target without a source Character', async () => {
    const targetActor = actor({
      id: ids.target,
      kind: 'CHARACTER',
      sourceId: ids.character
    })
    const value = preparedFeature(targetActor)
    const targetCharacter = {
      id: ids.character,
      systemId: targetActor.systemId!,
      streamVersion: 4,
      actor: targetActor,
      mechanics: {} as LockedTargetCharacter['mechanics'],
      overlay: {} as LockedTargetCharacter['overlay'],
      maximumHitPoints: 10,
      conditionDefinitions: [],
      activeConditionDefinitionIds: []
    }
    value.targets = {
      ...value.targets,
      characterIds: [ids.character],
      lockedCharacters: new Map([[ids.character, targetCharacter]])
    }
    state.applyCharacter.mockResolvedValue({
      updatedActor: { ...targetActor, currentHitPoints: 6 },
      streamVersion: 5,
      receiptApplications: [receiptApplication],
      targetTransition: transition
    })

    const settled = await settleEncounterMovementReactionAction({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000214',
      ordinal: 0,
      prepared: value,
      execution: execution()
    })

    expect(settled.application).toMatchObject({
      kind: 'CHARACTER_MECHANICS_BATCH',
      sourceCharacterStreamVersion: null,
      targetCharacterStreamVersion: 5
    })
    expect(state.applyCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ targetCharacterId: ids.character })
    )
    expect(state.persistResource).not.toHaveBeenCalled()
    expect(state.updateActor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: ids.actor,
        resources: { ruleUsage: { [ids.allowance]: 1 } }
      })
    )
  })
})
