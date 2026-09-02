import { describe, expect, it } from 'vitest'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  movementRuleResolutionCommandDtoSchema,
  serverRuleExecutionPendingApplicationContextDtoSchema,
  serverRuleExecutionReceiptCommandMetadataDtoSchema,
  storedRuleExecutionResultDtoSchema
} from '../shared/rulesExecution.js'

const ids = {
  actor: '00000000-0000-4000-8000-000000000101',
  actorTwo: '00000000-0000-4000-8000-000000000113',
  character: '00000000-0000-4000-8000-000000000102',
  characterTwo: '00000000-0000-4000-8000-000000000114',
  command: '00000000-0000-4000-8000-000000000103',
  commandTwo: '00000000-0000-4000-8000-000000000115',
  effect: '00000000-0000-4000-8000-000000000104',
  effectTwo: '00000000-0000-4000-8000-000000000112',
  encounter: '00000000-0000-4000-8000-000000000105',
  occurrence: '00000000-0000-4000-8000-000000000106',
  scene: '00000000-0000-4000-8000-000000000107',
  source: '00000000-0000-4000-8000-000000000108',
  entry: '00000000-0000-4000-8000-000000000109',
  token: '00000000-0000-4000-8000-000000000110',
  user: '00000000-0000-4000-8000-000000000111'
} as const

const checksum = (letter: string) => letter.repeat(64)
const path = [
  { x: 0, y: 0 },
  { x: 10, y: 0 }
]

function pendingCandidate(
  ordinal = 0,
  pathDistance = 5,
  effectId: string = ids.effect,
  sourceMoved = false,
  contact = { x: pathDistance, y: 0 },
  targetActorId: string = ids.actor,
  characterId: string = ids.character
) {
  return {
    ordinal,
    candidate: {
      contact,
      effectId,
      pathDistance,
      sourceActorId: ids.source,
      sourceMoved,
      targetActorId,
      trigger: 'ENTER' as const
    },
    effect: {
      effectId,
      version: 2,
      definitionChecksum: checksum('a'),
      lifecycleChecksum: checksum('b'),
      placementChecksum: checksum('c'),
      spatialStateChecksum: checksum('d'),
      authoredEffectId: ids.source,
      compiledEntryId: ids.entry,
      frozenGraphNodeId: 'effect',
      frozenSourceChecksum: checksum('e'),
      capabilityContractVersion: 1,
      activation: 'REPEATABLE' as const,
      revealed: false,
      revealOnTrigger: true
    },
    target: {
      kind: 'CHARACTER' as const,
      characterId,
      streamVersion: 4,
      projectionChecksum: checksum('f'),
      mechanicalContextChecksum: checksum('1'),
      targetStateChecksum: checksum('2')
    },
    d20Policy: null
  }
}

function pendingContext() {
  return {
    kind: 'ENCOUNTER_SPATIAL_MOVEMENT' as const,
    schemaVersion: 1 as const,
    root: {
      commandId: ids.command,
      commandFingerprint: checksum('3'),
      initiatorUserId: ids.user,
      correlationId: null,
      encounterId: ids.encounter,
      sceneId: ids.scene,
      tokenId: ids.token,
      expectedEncounterVersion: 7,
      expectedSceneVersion: 3,
      currentSceneVersion: 3,
      movementKind: 'VOLUNTARY' as const,
      originalPath: path,
      pathChecksum: checksumRuleDocument(path),
      pathStartDistance: 5,
      currentPosition: { x: 5, y: 0 },
      resolutionCommands: []
    },
    selectionChecksum: checksum('4'),
    completedExecutions: [],
    currentCandidate: pendingCandidate(),
    remainingCandidates: []
  }
}

function resolutionCommand(commandId: string, expectedOccurrenceVersion: number) {
  return {
    commandId,
    commandFingerprint: checksum('6'),
    actorUserId: ids.user,
    correlationId: null,
    expectedOccurrenceVersion,
    requestId: 'd20-request',
    kind: 'ENTER_DICE' as const
  }
}

function passageTerminalCommand() {
  const optionId = checksum('7')
  return {
    commandId: ids.command,
    commandFingerprint: checksum('6'),
    actorUserId: ids.user,
    correlationId: null,
    expectedOccurrenceVersion: 0,
    kind: 'PASSAGE_OPTION' as const,
    optionId,
    passageContest: {
      actionKind: 'OVERRUN' as const,
      optionId,
      outcome: 'SUCCESS' as const,
      initiator: {
        rollMode: 'NORMAL' as const,
        rawFaces: [15],
        selectedNatural: 15,
        modifier: 0,
        total: 15
      },
      defender: {
        rollMode: 'NORMAL' as const,
        rawFaces: [10],
        selectedNatural: 10,
        modifier: 0,
        total: 10
      },
      actionEconomy: {
        definitionId: ids.effect,
        definitionVersion: 1,
        definitionChecksum: checksum('8'),
        maximum: 1,
        beforeUsed: 0,
        afterUsed: 1
      },
      audit: {
        optionalCombat: {
          definitionId: ids.entry,
          definitionVersion: 1,
          definitionChecksum: checksum('9'),
          moduleKey: 'optional-combat.overrun',
          moduleContractVersion: 1
        },
        sourceActorId: ids.source,
        sourceTokenId: ids.token,
        blockerActorId: ids.actor,
        blockerTokenId: ids.effect,
        contact: { x: 2, y: 0 },
        contactPathDistance: 2,
        blockerCurrentnessChecksum: checksum('a'),
        selectionContractChecksum: checksum('b'),
        resolvedSelectionChecksum: checksum('c'),
        spatialSelectionChecksum: checksum('d'),
        spatialCurrentnessChecksum: checksum('e'),
        originalPath: path,
        pathChecksum: checksumRuleDocument(path),
        terminalPassageStop: {
          blockerActorId: ids.actorTwo,
          blockerTokenId: ids.commandTwo,
          contact: { x: 6, y: 0 },
          contactPathDistance: 6,
          blockerCurrentnessChecksum: checksum('f')
        },
        terminalPosition: { x: 6, y: 0 }
      }
    }
  }
}

function completedExecution(
  ordinal = 0,
  pathDistance = 5,
  effectId: string = ids.effect,
  targetActorId: string = ids.actor,
  characterId: string = ids.character
) {
  const candidate = pendingCandidate(
    ordinal,
    pathDistance,
    effectId,
    false,
    { x: pathDistance, y: 0 },
    targetActorId,
    characterId
  )
  return {
    ordinal,
    candidate,
    execution: {
      status: 'COMPLETE' as const,
      outputs: {},
      evidence: {
        source: {
          definitionId: ids.source,
          gameSystemId: ids.encounter,
          definitionFamilyKey: 'effect',
          checksum: candidate.effect.frozenSourceChecksum
        },
        capabilityContractVersion: 1,
        facts: {},
        sourceEntryBindings: [{ sourceEntryId: ids.entry, nodeId: 'effect' }],
        trace: [
          {
            nodeId: 'effect',
            operation: { key: 'effect.apply', contractVersion: 1 },
            inputs: {},
            outputs: {}
          }
        ],
        outputs: {}
      }
    },
    d20: null,
    targetTransition: {
      checksum: checksum('2'),
      before: {
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        conditionIds: []
      },
      after: {
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        conditionIds: []
      }
    },
    applications: []
  }
}

function spatialEffectTransition(effectId: string = ids.effect) {
  return {
    effectId,
    transition: {
      kind: 'UPDATE' as const,
      expectedVersion: 2,
      afterVersion: 3,
      definitionChecksum: checksum('a'),
      lifecycleChecksum: checksum('b'),
      placementChecksum: checksum('c'),
      beforeSpatialStateChecksum: checksum('d'),
      afterSpatialStateChecksum: checksumRuleDocument({
        schemaVersion: 1,
        revealed: true
      }),
      beforeRevealed: false as const,
      afterRevealed: true as const
    }
  }
}

describe('spatial movement rule contracts', () => {
  it('rejects corrupted self-contained terminal passage path evidence', () => {
    const command = passageTerminalCommand()
    expect(movementRuleResolutionCommandDtoSchema.safeParse(command).success).toBe(true)

    const audit = command.passageContest.audit
    expect(
      movementRuleResolutionCommandDtoSchema.safeParse({
        ...command,
        passageContest: {
          ...command.passageContest,
          audit: { ...audit, pathChecksum: checksum('0') }
        }
      }).success
    ).toBe(false)
    expect(
      movementRuleResolutionCommandDtoSchema.safeParse({
        ...command,
        passageContest: {
          ...command.passageContest,
          audit: {
            ...audit,
            terminalPassageStop: {
              ...audit.terminalPassageStop,
              contact: { x: 6, y: 1 }
            },
            terminalPosition: { x: 6, y: 1 }
          }
        }
      }).success
    ).toBe(false)
    expect(
      movementRuleResolutionCommandDtoSchema.safeParse({
        ...command,
        passageContest: {
          ...command.passageContest,
          audit: { ...audit, terminalPosition: { x: 7, y: 0 } }
        }
      }).success
    ).toBe(false)
  })

  it('retains a sealed, canonical pending path/contact context only while paused', () => {
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse(pendingContext())
    ).toMatchObject({
      kind: 'ENCOUNTER_SPATIAL_MOVEMENT'
    })
    for (const malformed of [
      {
        ...pendingContext(),
        root: { ...pendingContext().root, pathChecksum: checksum('0') }
      },
      {
        ...pendingContext(),
        root: { ...pendingContext().root, currentPosition: { x: 1, y: 0 } }
      },
      {
        ...pendingContext(),
        root: { ...pendingContext().root, pathStartDistance: 11 }
      },
      {
        ...pendingContext(),
        currentCandidate: pendingCandidate(1),
        remainingCandidates: [pendingCandidate(0, 6)]
      },
      {
        ...pendingContext(),
        currentCandidate: pendingCandidate(),
        remainingCandidates: [pendingCandidate(1, 5)]
      }
    ])
      expect(() => serverRuleExecutionPendingApplicationContextDtoSchema.parse(malformed)).toThrow()

    const sourceMovedMismatch = pendingContext()
    sourceMovedMismatch.currentCandidate = pendingCandidate(0, 5, ids.effect, true, { x: 2, y: 3 })
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse(sourceMovedMismatch)
    ).toThrow()

    const ordinaryMismatch = pendingContext()
    ordinaryMismatch.currentCandidate.candidate.contact = { x: 2, y: 3 }
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse(ordinaryMismatch)
    ).toThrow()

    const regressedSceneVersion = pendingContext()
    regressedSceneVersion.root.currentSceneVersion = 2
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse(regressedSceneVersion)
    ).toThrow()

    const duplicateResolutionCommand = pendingContext()
    duplicateResolutionCommand.root.resolutionCommands = [
      resolutionCommand(ids.command, 0),
      resolutionCommand(ids.command, 1)
    ] as never
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse(duplicateResolutionCommand)
    ).toThrow()

    const nonContiguousResolutionCommand = pendingContext()
    nonContiguousResolutionCommand.root.resolutionCommands = [
      resolutionCommand(ids.command, 1),
      resolutionCommand(ids.commandTwo, 2)
    ] as never
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse(nonContiguousResolutionCommand)
    ).toThrow()
  })

  it('stores a bounded terminal movement batch without a path or continuation', () => {
    const result = {
      status: 'BATCH_COMPLETE' as const,
      batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' as const,
      schemaVersion: 1 as const,
      occurrenceId: ids.occurrence,
      occurrenceVersion: 0,
      encounterId: ids.encounter,
      encounterVersion: 8,
      sceneId: ids.scene,
      sceneVersion: 4,
      tokenId: ids.token,
      movementKind: 'VOLUNTARY' as const,
      reactionExecutions: [],
      terminalPosition: { x: 10, y: 0 },
      executions: [completedExecution()],
      spatialEffectTransitions: [spatialEffectTransition()],
      characterTransitions: [] as Array<{
        characterId: string
        targetActorId: string
        beforeStreamVersion: number
        afterStreamVersion: number
        before: {
          currentHitPoints: number
          temporaryHitPoints: number
          maximumHitPoints: number
          conditionIds: string[]
        }
        after: {
          currentHitPoints: number
          temporaryHitPoints: number
          maximumHitPoints: number
          conditionIds: string[]
        }
      }>,
      encounterActorTransitions: []
    }
    expect(storedRuleExecutionResultDtoSchema.parse(result)).toMatchObject({
      batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT'
    })
    expect(
      storedRuleExecutionResultDtoSchema.safeParse({
        ...result,
        originalPath: path
      }).success
    ).toBe(false)
    expect(
      storedRuleExecutionResultDtoSchema.safeParse({
        ...result,
        continuation: { seal: checksum('9') }
      }).success
    ).toBe(false)
  })

  it('stores reaction-only movement completion without fabricating a spatial execution', () => {
    const result = {
      status: 'MOVEMENT_COMPLETE' as const,
      schemaVersion: 1 as const,
      occurrenceId: ids.occurrence,
      occurrenceVersion: 1,
      encounterId: ids.encounter,
      encounterVersion: 8,
      sceneId: ids.scene,
      sceneVersion: 4,
      tokenId: ids.token,
      movementKind: 'VOLUNTARY' as const,
      reactionExecutions: [],
      terminalPosition: { x: 10, y: 0 }
    }

    expect(storedRuleExecutionResultDtoSchema.parse(result)).toEqual(result)
    expect(
      storedRuleExecutionResultDtoSchema.safeParse({
        ...result,
        executions: []
      }).success
    ).toBe(false)
  })

  it('transitions each spatial root exactly once across multiple target executions', () => {
    const multiTarget = {
      status: 'BATCH_COMPLETE' as const,
      batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' as const,
      schemaVersion: 1 as const,
      occurrenceId: ids.occurrence,
      occurrenceVersion: 2,
      encounterId: ids.encounter,
      encounterVersion: 8,
      sceneId: ids.scene,
      sceneVersion: 4,
      tokenId: ids.token,
      movementKind: 'VOLUNTARY' as const,
      terminalPosition: { x: 10, y: 0 },
      executions: [
        completedExecution(),
        completedExecution(1, 6, ids.effect, ids.actorTwo, ids.characterTwo)
      ],
      spatialEffectTransitions: [spatialEffectTransition()],
      characterTransitions: [],
      encounterActorTransitions: []
    }
    expect(storedRuleExecutionResultDtoSchema.safeParse(multiTarget).success).toBe(true)

    expect(
      storedRuleExecutionResultDtoSchema.safeParse({
        ...multiTarget,
        spatialEffectTransitions: []
      }).success
    ).toBe(false)
    expect(
      storedRuleExecutionResultDtoSchema.safeParse({
        ...multiTarget,
        spatialEffectTransitions: [spatialEffectTransition(), spatialEffectTransition()]
      }).success
    ).toBe(false)
    expect(
      storedRuleExecutionResultDtoSchema.safeParse({
        ...multiTarget,
        spatialEffectTransitions: [spatialEffectTransition(ids.effectTwo)]
      }).success
    ).toBe(false)

    const mismatchedSnapshot = structuredClone(multiTarget)
    mismatchedSnapshot.executions[1]!.candidate.effect.version = 3
    expect(storedRuleExecutionResultDtoSchema.safeParse(mismatchedSnapshot).success).toBe(false)

    expect(
      storedRuleExecutionResultDtoSchema.safeParse({
        ...multiTarget,
        spatialEffectTransitions: [
          {
            effectId: ids.effect,
            transition: {
              kind: 'DELETE',
              expectedVersion: 2,
              definitionChecksum: checksum('a'),
              lifecycleChecksum: checksum('b'),
              placementChecksum: checksum('c'),
              spatialStateChecksum: checksum('d')
            }
          }
        ]
      }).success
    ).toBe(false)
  })

  it('binds terminal target currentness and chains repeated target applications', () => {
    const result = {
      status: 'BATCH_COMPLETE' as const,
      batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' as const,
      schemaVersion: 1 as const,
      occurrenceId: ids.occurrence,
      occurrenceVersion: 2,
      encounterId: ids.encounter,
      encounterVersion: 8,
      sceneId: ids.scene,
      sceneVersion: 4,
      tokenId: ids.token,
      movementKind: 'VOLUNTARY' as const,
      terminalPosition: { x: 10, y: 0 },
      executions: [completedExecution()],
      spatialEffectTransitions: [spatialEffectTransition()],
      characterTransitions: [] as Array<{
        characterId: string
        targetActorId: string
        beforeStreamVersion: number
        afterStreamVersion: number
        before: {
          currentHitPoints: number
          temporaryHitPoints: number
          maximumHitPoints: number
          conditionIds: string[]
        }
        after: {
          currentHitPoints: number
          temporaryHitPoints: number
          maximumHitPoints: number
          conditionIds: string[]
        }
      }>,
      encounterActorTransitions: []
    }
    const mismatchedCurrentness = structuredClone(result)
    mismatchedCurrentness.executions[0]!.targetTransition.checksum = checksum('9')
    expect(storedRuleExecutionResultDtoSchema.safeParse(mismatchedCurrentness).success).toBe(false)

    const unchangedProvidedTransition = structuredClone(result)
    unchangedProvidedTransition.characterTransitions = [
      {
        characterId: ids.character,
        targetActorId: ids.actor,
        beforeStreamVersion: 4,
        afterStreamVersion: 5,
        before: unchangedProvidedTransition.executions[0]!.targetTransition.before,
        after: unchangedProvidedTransition.executions[0]!.targetTransition.after
      }
    ]
    expect(storedRuleExecutionResultDtoSchema.safeParse(unchangedProvidedTransition).success).toBe(
      false
    )

    const changed = structuredClone(result)
    changed.executions[0]!.targetTransition.after.currentHitPoints = 9
    changed.characterTransitions = [
      {
        characterId: ids.character,
        targetActorId: ids.actor,
        beforeStreamVersion: 4,
        afterStreamVersion: 5,
        before: changed.executions[0]!.targetTransition.before,
        after: changed.executions[0]!.targetTransition.after
      }
    ]
    expect(storedRuleExecutionResultDtoSchema.safeParse(changed).success).toBe(true)

    const chained = structuredClone(changed)
    const second = completedExecution(1, 6, ids.effectTwo)
    second.targetTransition.before = structuredClone(chained.executions[0]!.targetTransition.after)
    second.targetTransition.after.currentHitPoints = 8
    chained.executions.push(second)
    chained.spatialEffectTransitions.push(spatialEffectTransition(ids.effectTwo))
    chained.characterTransitions[0]!.after = second.targetTransition.after
    expect(storedRuleExecutionResultDtoSchema.safeParse(chained).success).toBe(true)

    const brokenChain = structuredClone(chained)
    brokenChain.executions[1]!.targetTransition.before.currentHitPoints = 10
    expect(storedRuleExecutionResultDtoSchema.safeParse(brokenChain).success).toBe(false)

    const netZero = structuredClone(chained)
    netZero.executions[1]!.targetTransition.after = structuredClone(
      netZero.executions[0]!.targetTransition.before
    )
    netZero.characterTransitions = []
    expect(storedRuleExecutionResultDtoSchema.safeParse(netZero).success).toBe(true)
  })

  it('retains receipt metadata without the movement graph, path, or hidden facts', () => {
    const metadata = {
      schemaVersion: 1 as const,
      transition: 'SPATIAL_MOVEMENT' as const,
      commandType: 'MOVE_SCENE_TOKEN' as const,
      rootCommandId: ids.command,
      rootCommandFingerprint: checksum('3'),
      rootInitiatorUserId: ids.user,
      rootCorrelationId: null,
      encounterId: ids.encounter,
      sceneId: ids.scene,
      tokenId: ids.token,
      movementKind: 'VOLUNTARY' as const,
      expectedEncounterVersion: 7,
      expectedSceneVersion: 3,
      rootExpectedEncounterVersion: 7,
      rootExpectedSceneVersion: 3,
      encounterVersionTransition: 'ADVANCED' as const,
      sceneVersionTransition: 'ADVANCED' as const,
      currentnessChecksum: checksum('6'),
      selectionChecksum: checksum('4'),
      occurrenceVersion: 0,
      changedAggregates: [
        {
          aggregateKind: 'ENCOUNTER' as const,
          aggregateId: ids.encounter,
          beforeVersion: 7,
          version: 8
        },
        {
          aggregateKind: 'SCENE' as const,
          aggregateId: ids.scene,
          beforeVersion: 3,
          version: 4
        }
      ],
      resolutionCommands: []
    }
    expect(serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(metadata)).toMatchObject({
      transition: 'SPATIAL_MOVEMENT'
    })
    const pendingRootMetadata = {
      ...metadata,
      encounterVersionTransition: 'UNCHANGED' as const,
      changedAggregates: [metadata.changedAggregates[1]!]
    }
    expect(
      serverRuleExecutionReceiptCommandMetadataDtoSchema.safeParse(pendingRootMetadata).success
    ).toBe(true)
    expect(
      serverRuleExecutionReceiptCommandMetadataDtoSchema.safeParse({
        ...pendingRootMetadata,
        changedAggregates: [
          {
            aggregateKind: 'CHARACTER',
            aggregateId: ids.character,
            beforeVersion: 1,
            version: 2
          },
          ...pendingRootMetadata.changedAggregates
        ]
      }).success
    ).toBe(false)
    expect(
      serverRuleExecutionReceiptCommandMetadataDtoSchema.safeParse({
        ...metadata,
        path
      }).success
    ).toBe(false)

    const resolvedMetadata = {
      ...metadata,
      commandType: 'RESOLVE_RULE_OCCURRENCE' as const,
      occurrenceVersion: 2,
      resolutionCommands: [
        {
          commandId: ids.command,
          commandFingerprint: checksum('6'),
          actorUserId: ids.user,
          correlationId: null,
          expectedOccurrenceVersion: 0,
          kind: 'DECLINE' as const
        },
        resolutionCommand(ids.commandTwo, 1)
      ]
    }
    expect(
      serverRuleExecutionReceiptCommandMetadataDtoSchema.safeParse(resolvedMetadata).success
    ).toBe(true)
    for (const malformed of [
      { ...resolvedMetadata, resolutionCommands: [] },
      {
        ...resolvedMetadata,
        resolutionCommands: [resolutionCommand(ids.command, 0), resolutionCommand(ids.command, 1)]
      },
      {
        ...resolvedMetadata,
        resolutionCommands: [
          resolutionCommand(ids.command, 0),
          resolutionCommand(ids.commandTwo, 2)
        ]
      },
      { ...metadata, occurrenceVersion: 1 }
    ])
      expect(serverRuleExecutionReceiptCommandMetadataDtoSchema.safeParse(malformed).success).toBe(
        false
      )
  })
})
