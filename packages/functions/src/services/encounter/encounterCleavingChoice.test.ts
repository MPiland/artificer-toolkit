import { describe, expect, it, vi } from 'vitest'

import type { EncounterRecord, RuleOccurrenceRecord } from '@artificer-toolkit/db'
import {
  DND5E_CLEAVING_DEFINITION_ID,
  DND5E_CLEAVING_OPERATION_KEY,
  encounterOptionalCombatSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import {
  serverAggregateChoicePendingSnapshotDtoSchema,
  type ServerRuleExecutionApplicationOutputsDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { DND5E_SYSTEM_ID } from '../rules/systems/dnd5e/characterActionCapabilityDiscovery.js'
import {
  cleavingChildCommandIdentity,
  cleavingChildOccurrenceIdentity,
  createEncounterCleavingChoicePendingSnapshot,
  settleEncounterCleavingChoice,
  type EncounterCleavingSettlementFacts
} from './encounterCleavingChoice.js'

const settlement = vi.hoisted(() => ({
  advanceVersion: vi.fn(async (expectedVersion: number) => expectedVersion + 1),
  appendReceipt: vi.fn(async () => undefined),
  bindings: vi.fn<() => Promise<Array<{ actorId: string; tokenId: string }>>>(async () => []),
  createPending: vi.fn(async () => undefined),
  complete: vi.fn(async (input: { occurrenceId: string }) => ({
    id: input.occurrenceId,
    version: 1,
    state: 'COMPLETED'
  })),
  findTerminalReceiptByOccurrence: vi.fn(),
  lockTargets: vi.fn(),
  revalidateScene: vi.fn(),
  publishCurrentProjection: vi.fn(async () => undefined),
  updateActor: vi.fn(async () => undefined),
  applyActorBatch: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal()),
  createEncounterRepository: () => ({
    publishCurrentProjection: settlement.publishCurrentProjection,
    updateActor: settlement.updateActor
  }),
  createVttSceneRepository: () => ({ listActorTokenBindings: settlement.bindings }),
  createRuleOccurrenceRepository: () => ({
    appendReceipt: settlement.appendReceipt,
    complete: settlement.complete,
    createPending: settlement.createPending,
    findTerminalReceiptByOccurrence: settlement.findTerminalReceiptByOccurrence
  })
}))

vi.mock('./encounterActorRuleEvaluation.js', () => ({
  evaluateEncounterActorRuleSnapshot: vi.fn(
    async ({ encounter }: { encounter: EncounterRecord }) => ({
      reconciledEncounter: encounter,
      snapshot: { output: {} }
    })
  )
}))

vi.mock('./encounterActionSceneContext.js', () => ({
  revalidateEncounterActionSceneDependency: settlement.revalidateScene
}))

vi.mock('./encounterActiveEffectTargetState.js', () => ({
  lockEncounterActiveEffectTargets: settlement.lockTargets
}))

vi.mock('./encounterCharacterMechanicsBatch.js', () => ({
  applyLockedEncounterActorMechanicsBatch: settlement.applyActorBatch,
  applyLockedEncounterCharacterMechanicsBatch: vi.fn()
}))

vi.mock('./encounterProjection.js', async (importOriginal) => ({
  ...(await importOriginal()),
  compileEncounterCurrentProjection: vi.fn(() => ({})),
  projectGm: vi.fn(() => ({})),
  snapshotStatBlock: vi.fn(() => ({ armorClass: 14 }))
}))

const ids = {
  encounter: '00000000-0000-4000-8000-000000000001',
  source: '00000000-0000-4000-8000-000000000002',
  initial: '00000000-0000-4000-8000-000000000003',
  candidate: '00000000-0000-4000-8000-000000000004',
  next: '00000000-0000-4000-8000-000000000011',
  controller: '00000000-0000-4000-8000-00000000000a',
  sourceToken: '00000000-0000-4000-8000-000000000005',
  candidateToken: '00000000-0000-4000-8000-000000000006',
  parent: '00000000-0000-4000-8000-000000000007',
  scene: '00000000-0000-4000-8000-000000000008',
  damageType: '00000000-0000-4000-8000-000000000009',
  range: '00000000-0000-4000-8000-000000000013'
}
const checksum = 'a'.repeat(64)

function encounter(): EncounterRecord {
  const document = {
    schemaVersion: 1 as const,
    kind: 'CLEAVING' as const,
    id: DND5E_CLEAVING_DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    module: { policyModuleKey: DND5E_CLEAVING_OPERATION_KEY, contractVersion: 1 },
    parameters: {
      kind: 'CLEAVING' as const,
      qualifyingAttackKind: 'MELEE' as const,
      requiresUndamagedInitialTarget: true as const
    },
    mutuallyExclusiveGroup: null
  }
  const optionalCombatSnapshot = encounterOptionalCombatSnapshotDtoSchema.parse({
    schemaVersion: 1,
    gameSystemId: DND5E_SYSTEM_ID,
    definitions: [
      {
        definitionId: DND5E_CLEAVING_DEFINITION_ID,
        contentSourceId: '00000000-0000-4000-8000-000000000010',
        definitionVersion: 1,
        definitionChecksum: checksumRuleDocument(document),
        contractVersion: 1,
        label: 'Cleaving',
        document
      }
    ]
  })
  return {
    id: ids.encounter,
    gameSystemId: DND5E_SYSTEM_ID,
    automationMode: 'AUTOMATIC',
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumRuleDocument(optionalCombatSnapshot)
  } as unknown as EncounterRecord
}

function application(): Extract<
  ServerRuleExecutionApplicationOutputsDto,
  { kind: 'CHARACTER_MECHANICS_BATCH' | 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
> {
  return {
    kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
    nestedD20: null,
    d20: { total: 16, selectedNatural: 14 },
    targetTransition: {
      before: {
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10
      },
      after: {
        currentHitPoints: 0,
        temporaryHitPoints: 0,
        maximumHitPoints: 10
      }
    },
    applications: [
      {
        kind: 'DAMAGE',
        sourceNodeId: 'damage',
        sourceOperationKey: 'damage.apply',
        damageTypeId: ids.damageType,
        requestedAmount: 15,
        resolvedAmount: 15,
        appliedAmount: 10,
        beforeCurrentHitPoints: 10,
        afterCurrentHitPoints: 0,
        beforeTemporaryHitPoints: 0,
        afterTemporaryHitPoints: 0,
        maximumHitPoints: 10,
        targetActorId: ids.initial,
        damageDisposition: 'NORMAL'
      }
    ]
  } as unknown as Extract<
    ServerRuleExecutionApplicationOutputsDto,
    { kind: 'CHARACTER_MECHANICS_BATCH' | 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
  >
}

function pendingForSettlement() {
  const parentResult = { status: 'COMPLETE', applicationOutputs: { kind: 'NONE' } }
  const pending = createEncounterCleavingChoicePendingSnapshot({
    encounter: encounter(),
    application: application(),
    action: {
      actionId: 'cleave-test-action',
      publishedDefinitionId: ids.parent,
      publishedDefinitionChecksum: checksum,
      attackKind: 'MELEE',
      range: { id: ids.range, rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' }
    },
    actionMechanic: { attackKind: 'MELEE' },
    activeEffectTransitions: [],
    stateEffectTransitions: [],
    candidates: [
      {
        actorId: ids.candidate,
        armorClass: 14,
        footprintChecksum: checksum,
        originalAttackCanHit: true,
        targetActorVersion: 2,
        targetStateChecksum: checksum,
        targetTokenId: ids.candidateToken,
        withinAttackerReach: true
      }
    ],
    chainStep: 0,
    initialTargetActorId: ids.initial,
    parentOccurrenceId: ids.parent,
    parentResultChecksum: checksumRuleDocument(parentResult),
    sourceActorId: ids.source,
    sourceControllerCharacterId: ids.controller,
    sourceCurrentness: {
      kind: 'ENCOUNTER_ACTOR',
      actorId: ids.source,
      sourceRevision: 1,
      sourceVersionId: ids.parent,
      sourceChecksum: checksum,
      stateChecksum: checksum
    },
    scene: {
      sceneId: ids.scene,
      sceneVersion: 3,
      effectiveGridChecksum: checksum,
      sourceTokenId: ids.sourceToken
    },
    visitedTargetActorIds: [ids.initial]
  })
  if (!pending) throw new Error('Expected a Cleaving pending snapshot.')
  return { parentResult, pending }
}

function creatureActor(id: string, hitPoints: number) {
  return {
    id,
    kind: 'CREATURE',
    conditions: [],
    currentHitPoints: hitPoints,
    maxHitPoints: 10,
    snapshot: { payload: { armorClass: 14 } },
    sourceRevision: 1,
    tempHitPoints: 0
  }
}

function cleavingScene(sourceTokenId: string, targetTokenId: string, nextTokenId: string) {
  const grid = { kind: 'GRIDLESS' as const, pixelsPerUnit: 1, unit: 'FEET' as const }
  const token = (id: string, x: number) => ({
    height: 1,
    id,
    position: { x, y: 0 },
    rotationDegrees: 0,
    width: 1
  })
  const sourceToken = token(sourceTokenId, 0)
  const targetToken = token(targetTokenId, 2)
  const nextToken = token(nextTokenId, 4)
  return {
    grid,
    scene: {
      state: { id: ids.scene, version: 3, grid, tokens: [sourceToken, targetToken, nextToken] }
    },
    sourceToken: { ...sourceToken, tokenId: sourceToken.id, actorId: ids.source },
    targetToken: { ...targetToken, tokenId: targetToken.id, actorId: ids.candidate },
    nextToken: { ...nextToken, tokenId: nextToken.id, actorId: ids.next }
  }
}

function pendingForSelectedSettlement() {
  const source = creatureActor(ids.source, 12)
  const selected = { ...creatureActor(ids.candidate, 5), maxHitPoints: 5 }
  const next = creatureActor(ids.next, 10)
  const selectedToken = '00000000-0000-4000-8000-00000000000e'
  const nextToken = '00000000-0000-4000-8000-00000000000f'
  const scene = cleavingScene(ids.sourceToken, selectedToken, nextToken)
  const currentEncounter = {
    ...encounter(),
    version: 4,
    actors: [source, selected, next]
  } as unknown as EncounterRecord
  const parentResult = { status: 'COMPLETE', applicationOutputs: { kind: 'NONE' } }
  const initialApplication = application()
  const initialDamage = initialApplication.applications[0]!
  const cleavingApplication = {
    ...initialApplication,
    applications: [
      {
        ...initialDamage,
        requestedAmount: 25,
        resolvedAmount: 25
      }
    ]
  }
  const pending = createEncounterCleavingChoicePendingSnapshot({
    encounter: currentEncounter,
    application: cleavingApplication,
    action: {
      actionId: 'cleave-test-action',
      publishedDefinitionId: ids.parent,
      publishedDefinitionChecksum: checksum,
      attackKind: 'MELEE',
      range: { id: ids.range, rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' }
    },
    actionMechanic: { attackKind: 'MELEE' },
    activeEffectTransitions: [],
    stateEffectTransitions: [],
    candidates: [
      {
        actorId: ids.candidate,
        armorClass: 14,
        footprintChecksum: checksumRuleDocument({
          height: 1,
          position: { x: 2, y: 0 },
          rotationDegrees: 0,
          tokenId: selectedToken,
          width: 1
        }),
        originalAttackCanHit: true,
        targetActorVersion: 1,
        targetStateChecksum: checksumRuleDocument(selected),
        targetTokenId: selectedToken,
        withinAttackerReach: true
      }
    ],
    chainStep: 0,
    initialTargetActorId: ids.initial,
    parentOccurrenceId: ids.parent,
    parentResultChecksum: checksumRuleDocument(parentResult),
    sourceActorId: ids.source,
    sourceControllerCharacterId: null,
    sourceCurrentness: {
      kind: 'ENCOUNTER_ACTOR',
      actorId: ids.source,
      sourceRevision: 1,
      sourceVersionId: ids.parent,
      sourceChecksum: checksum,
      stateChecksum: checksumRuleDocument(source)
    },
    scene: {
      sceneId: ids.scene,
      sceneVersion: 3,
      effectiveGridChecksum: checksumRuleDocument(scene.grid),
      sourceTokenId: ids.sourceToken
    },
    visitedTargetActorIds: [ids.initial]
  })
  if (!pending) throw new Error('Expected a selected Cleaving pending snapshot.')
  return { currentEncounter, next, nextToken, parentResult, pending, scene, selected }
}

describe('Encounter Cleaving choice', () => {
  it('creates one deterministic human choice with only frozen excess damage', () => {
    const pending = createEncounterCleavingChoicePendingSnapshot({
      encounter: encounter(),
      application: application(),
      action: {
        actionId: 'cleave-test-action',
        publishedDefinitionId: ids.parent,
        publishedDefinitionChecksum: checksum,
        attackKind: 'MELEE',
        range: { id: ids.range, rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' }
      },
      actionMechanic: { attackKind: 'MELEE' },
      activeEffectTransitions: [],
      stateEffectTransitions: [],
      candidates: [
        {
          actorId: ids.candidate,
          armorClass: 14,
          footprintChecksum: checksum,
          originalAttackCanHit: true,
          targetActorVersion: 2,
          targetStateChecksum: checksum,
          targetTokenId: ids.candidateToken,
          withinAttackerReach: true
        }
      ],
      chainStep: 0,
      initialTargetActorId: ids.initial,
      parentOccurrenceId: ids.parent,
      parentResultChecksum: checksum,
      sourceActorId: ids.source,
      sourceControllerCharacterId: null,
      sourceCurrentness: {
        kind: 'ENCOUNTER_ACTOR',
        actorId: ids.source,
        sourceRevision: 1,
        sourceVersionId: ids.parent,
        sourceChecksum: checksum,
        stateChecksum: checksum
      },
      scene: {
        sceneId: ids.scene,
        sceneVersion: 3,
        effectiveGridChecksum: checksum,
        sourceTokenId: ids.sourceToken
      },
      visitedTargetActorIds: [ids.initial]
    })

    expect(pending?.occurrenceId).toBe(
      cleavingChildOccurrenceIdentity({ parentOccurrenceId: ids.parent, chainStep: 1 })
    )
    expect(cleavingChildCommandIdentity({ occurrenceId: pending!.occurrenceId })).toMatch(
      /^[a-f0-9-]{36}$/
    )
    expect(pending?.applicationContext).toMatchObject({
      kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING',
      chainStep: 1,
      damage: { remainingAmount: 5 },
      options: [{ targetActorId: ids.candidate }]
    })
  })

  it('retains the original target as the immutable Cleaving chain root', () => {
    const { pending } = pendingForSettlement()
    const context = pending.applicationContext
    if (context.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING')
      throw new Error('Expected Cleaving context.')
    expect(
      serverAggregateChoicePendingSnapshotDtoSchema.safeParse({
        ...pending,
        applicationContext: {
          ...context,
          initialTargetActorId: ids.candidate
        }
      }).success
    ).toBe(false)
  })

  it('fails closed when a rider or multiple damage applications are present', () => {
    const base = {
      encounter: encounter(),
      application: application(),
      action: {
        actionId: 'cleave-test-action',
        publishedDefinitionId: ids.parent,
        publishedDefinitionChecksum: checksum,
        attackKind: 'MELEE',
        range: { id: ids.range, rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' }
      },
      actionMechanic: { attackKind: 'MELEE' },
      activeEffectTransitions: [],
      candidates: [],
      chainStep: 0,
      initialTargetActorId: ids.initial,
      parentOccurrenceId: ids.parent,
      parentResultChecksum: checksum,
      sourceActorId: ids.source,
      sourceControllerCharacterId: null,
      sourceCurrentness: {
        kind: 'ENCOUNTER_ACTOR',
        actorId: ids.source,
        sourceRevision: 1,
        sourceVersionId: ids.parent,
        sourceChecksum: checksum,
        stateChecksum: checksum
      },
      scene: {
        sceneId: ids.scene,
        sceneVersion: 3,
        effectiveGridChecksum: checksum,
        sourceTokenId: ids.sourceToken
      },
      stateEffectTransitions: [{}],
      visitedTargetActorIds: [ids.initial]
    }
    expect(
      createEncounterCleavingChoicePendingSnapshot(
        base as unknown as EncounterCleavingSettlementFacts
      )
    ).toBeNull()
    expect(
      createEncounterCleavingChoicePendingSnapshot({
        ...base,
        stateEffectTransitions: [],
        application: {
          ...application(),
          applications: [...application().applications, application().applications[0]!]
        }
      } as unknown as EncounterCleavingSettlementFacts)
    ).toBeNull()
  })

  it('lets only the source Character controller decline once and writes a terminal receipt', async () => {
    settlement.advanceVersion.mockClear()
    settlement.appendReceipt.mockClear()
    settlement.complete.mockClear()
    settlement.updateActor.mockClear()
    settlement.publishCurrentProjection.mockClear()
    const { parentResult, pending } = pendingForSettlement()
    settlement.findTerminalReceiptByOccurrence.mockResolvedValue({ resultPayload: parentResult })
    const currentEncounter = {
      ...encounter(),
      version: 4,
      actors: [{ id: ids.source, kind: 'CREATURE' }]
    } as unknown as EncounterRecord
    const occurrence = {
      id: pending.occurrenceId,
      state: 'PENDING',
      version: 0,
      pendingSnapshot: pending
    } as RuleOccurrenceRecord

    const settled = await settleEncounterCleavingChoice({
      db: {} as never,
      command: {
        commandId: '00000000-0000-4000-8000-00000000000b',
        commandFingerprint: 'b'.repeat(64),
        correlationId: null,
        expectedEncounterVersion: 4,
        expectedOccurrenceVersion: 0,
        occurrenceId: pending.occurrenceId,
        resolution: { kind: 'DECLINE' }
      },
      locked: {
        encounter: currentEncounter,
        context: {
          actorUserId: ids.controller,
          assignedCharacterId: ids.controller,
          currentVersion: 4,
          role: 'PLAYER',
          advanceVersion: settlement.advanceVersion
        }
      },
      occurrence
    })

    expect(settled.result.applicationOutputs).toMatchObject({
      kind: 'CLEAVING_DAMAGE',
      outcome: 'DECLINED',
      targetActorId: null,
      damage: { requestedAmount: 5, appliedAmount: 0 }
    })
    expect(settlement.complete).toHaveBeenCalledOnce()
    expect(settlement.appendReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        commandType: 'RESOLVE_RULE_OCCURRENCE',
        resultPayload: expect.objectContaining({ status: 'AGGREGATE_CHOICE_COMPLETE' })
      })
    )
    expect(settlement.updateActor).not.toHaveBeenCalled()
  })

  it('rejects an unrelated controller and stale versions before mutating a Cleaving choice', async () => {
    settlement.advanceVersion.mockClear()
    settlement.appendReceipt.mockClear()
    settlement.complete.mockClear()
    const { pending } = pendingForSettlement()
    const currentEncounter = {
      ...encounter(),
      version: 4,
      actors: [{ id: ids.source, kind: 'CREATURE' }]
    } as unknown as EncounterRecord
    const occurrence = {
      id: pending.occurrenceId,
      state: 'PENDING',
      version: 0,
      pendingSnapshot: pending
    } as RuleOccurrenceRecord
    const command = {
      commandId: '00000000-0000-4000-8000-00000000000c',
      commandFingerprint: 'c'.repeat(64),
      correlationId: null,
      expectedEncounterVersion: 4,
      expectedOccurrenceVersion: 0,
      occurrenceId: pending.occurrenceId,
      resolution: { kind: 'DECLINE' as const }
    }
    const locked = {
      encounter: currentEncounter,
      context: {
        actorUserId: '00000000-0000-4000-8000-00000000000d',
        assignedCharacterId: '00000000-0000-4000-8000-00000000000d',
        currentVersion: 4,
        role: 'PLAYER' as const,
        advanceVersion: settlement.advanceVersion
      }
    }

    await expect(
      settleEncounterCleavingChoice({ db: {} as never, command, locked, occurrence })
    ).rejects.toThrow('Cleaving choice is unavailable')
    await expect(
      settleEncounterCleavingChoice({
        db: {} as never,
        command: { ...command, expectedEncounterVersion: 3 },
        locked: { ...locked, context: { ...locked.context, actorUserId: ids.controller } },
        occurrence
      })
    ).rejects.toThrow('Cleaving choice is stale')
    expect(settlement.complete).not.toHaveBeenCalled()
    expect(settlement.appendReceipt).not.toHaveBeenCalled()
  })

  it('applies only the sealed excess damage once to the authorized frozen target', async () => {
    settlement.advanceVersion.mockClear()
    settlement.appendReceipt.mockClear()
    settlement.complete.mockClear()
    settlement.applyActorBatch.mockClear()
    const { currentEncounter, parentResult, pending, scene, selected } =
      pendingForSelectedSettlement()
    const context = pending.applicationContext
    if (context.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING')
      throw new Error('Expected a Cleaving choice context.')
    const selectedOption = context.options[0]
    if (!selectedOption) throw new Error('Expected a Cleaving target option.')
    settlement.findTerminalReceiptByOccurrence.mockResolvedValue({ resultPayload: parentResult })
    settlement.revalidateScene.mockResolvedValue({
      grid: scene.grid,
      scene: scene.scene,
      sourceToken: scene.sourceToken,
      targetToken: scene.targetToken
    })
    settlement.lockTargets.mockResolvedValue({
      effectiveScalarValuesByActorId: new Map(),
      lockedCharacters: new Map()
    })
    settlement.bindings.mockResolvedValue([
      { actorId: ids.source, tokenId: scene.sourceToken.tokenId },
      { actorId: ids.candidate, tokenId: scene.targetToken.tokenId },
      { actorId: ids.next, tokenId: scene.nextToken.tokenId }
    ])
    const updatedSelected = { ...selected, currentHitPoints: 0 }
    settlement.applyActorBatch.mockResolvedValue({
      updatedActor: updatedSelected,
      targetTransition: {
        checksum: checksum,
        before: {
          currentHitPoints: 5,
          temporaryHitPoints: 0,
          maximumHitPoints: 5,
          conditionIds: [],
          scalarValues: {}
        },
        after: {
          currentHitPoints: 0,
          temporaryHitPoints: 0,
          maximumHitPoints: 5,
          conditionIds: [],
          scalarValues: {}
        }
      }
    })
    const occurrence = {
      id: pending.occurrenceId,
      state: 'PENDING',
      version: 0,
      pendingSnapshot: pending
    } as RuleOccurrenceRecord

    const settled = await settleEncounterCleavingChoice({
      db: {} as never,
      command: {
        commandId: '00000000-0000-4000-8000-000000000012',
        commandFingerprint: 'd'.repeat(64),
        correlationId: null,
        expectedEncounterVersion: 4,
        expectedOccurrenceVersion: 0,
        occurrenceId: pending.occurrenceId,
        resolution: { kind: 'OPTION', optionId: selectedOption.optionId }
      },
      locked: {
        encounter: currentEncounter,
        context: {
          actorUserId: ids.controller,
          assignedCharacterId: null,
          currentVersion: 4,
          role: 'OWNER',
          advanceVersion: settlement.advanceVersion
        }
      },
      occurrence
    })

    expect(settlement.applyActorBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        applications: [
          expect.objectContaining({
            requestedAmount: 15,
            resolvedAmount: 15,
            appliedAmount: 5,
            damageTypeId: ids.damageType
          })
        ]
      })
    )
    expect(settled.result.applicationOutputs).toMatchObject({
      kind: 'CLEAVING_DAMAGE',
      outcome: 'APPLIED',
      targetActorId: ids.candidate,
      damage: { requestedAmount: 15, resolvedAmount: 15, appliedAmount: 5 }
    })
    expect(settlement.createPending).toHaveBeenCalledTimes(1)
    expect(settlement.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateKind: 'ENCOUNTER',
        aggregateId: ids.encounter,
        expectedAggregateVersion: 5,
        pendingSnapshot: expect.objectContaining({
          applicationContext: expect.objectContaining({
            kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING',
            chainStep: 2,
            initialTargetActorId: ids.initial,
            damage: expect.objectContaining({ remainingAmount: 10 }),
            options: [expect.objectContaining({ targetActorId: ids.next })],
            visitedTargetActorIds: [ids.initial, ids.candidate]
          })
        })
      })
    )
  })
})
