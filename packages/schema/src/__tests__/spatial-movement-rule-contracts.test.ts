import { describe, expect, it } from 'vitest'

import { NO_DEATH_SAVES } from '../subjects/characterState.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { encounterSpatialRuleEffectRecordSchema } from '../projections/spatialRuleEffectPersistence.js'
import {
  movementRuleResolutionCommandDtoSchema,
  serverRuleExecutionPendingApplicationContextDtoSchema,
  serverRuleExecutionReceiptCommandMetadataDtoSchema,
  storedRuleExecutionResultDtoSchema
} from '../shared/rulesExecution.js'
import { movementReactionActionExecutionDtoSchema } from '../shared/ruleExecutionMovementReactionReceipts.js'
import { spatialMovementExecutionDtoSchema } from '../shared/ruleExecutionEffectEvidence.js'
import type { ServerRuleExecutionPendingApplicationContextDto } from '../shared/ruleExecutionPendingApplication.js'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  serverRuleExecutionPendingOccurrenceId
} from '../shared/ruleExecutionPendingSnapshots.js'

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

type MovementReactionPendingContext = Extract<
  ServerRuleExecutionPendingApplicationContextDto,
  { kind: 'ENCOUNTER_MOVEMENT_REACTION' }
>
type MovementReactionActionPendingContext = Omit<MovementReactionPendingContext, 'phase'> & {
  phase: Extract<MovementReactionPendingContext['phase'], { kind: 'ACTION_EVIDENCE' }>
}
type MovementConcentrationPendingContext = Omit<MovementReactionPendingContext, 'phase'> & {
  phase: Extract<MovementReactionPendingContext['phase'], { kind: 'CONCENTRATION_EVIDENCE' }>
}

function isMovementReactionActionPendingContext(
  context: MovementReactionPendingContext
): context is MovementReactionActionPendingContext {
  return context.phase.kind === 'ACTION_EVIDENCE'
}

function isMovementConcentrationPendingContext(
  context: MovementReactionPendingContext
): context is MovementConcentrationPendingContext {
  return context.phase.kind === 'CONCENTRATION_EVIDENCE'
}

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
    d20Policy: null,
    diceStage: null
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
        keep: 'FIRST' as const,
        rawFaces: [15],
        selectedNatural: 15,
        modifier: 0,
        total: 15
      },
      defender: {
        rollMode: 'NORMAL' as const,
        keep: 'FIRST' as const,
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
        conditionIds: [] as string[],
        scalarValues: {},
        deathSaves: NO_DEATH_SAVES
      },
      after: {
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        conditionIds: [] as string[],
        scalarValues: {},
        deathSaves: NO_DEATH_SAVES
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

function reactionExecution(
  sourceResourceOnly = false
): ReturnType<typeof movementReactionActionExecutionDtoSchema.parse> {
  const before = {
    currentHitPoints: 9,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    scalarValues: {},
    conditionIds: [],
    deathSaves: NO_DEATH_SAVES
  }
  const after = { ...before, currentHitPoints: 8 }
  return movementReactionActionExecutionDtoSchema.parse({
    ordinal: 0,
    sourceCommandId: ids.commandTwo,
    option: {
      optionId: checksum('7'),
      contactSourceId: checksum('8'),
      actionId: 'reaction-action',
      actionSourceKind: 'CHARACTER_ACTION' as const,
      actionSourceCurrentnessChecksum: checksum('9'),
      candidate: {
        contact: { x: 6, y: 0 },
        movingActorId: ids.actor,
        pathDistance: 6,
        reactorActorId: ids.actorTwo,
        reactorTokenId: ids.token,
        sourceId: checksum('8'),
        stage: 'BEFORE_LEAVE_REACH' as const
      },
      binding: {
        kind: 'MOVEMENT' as const,
        stage: 'BEFORE_LEAVE_REACH' as const,
        perceptionRequirement: 'SEE' as const,
        eligibilityDefinitionId: ids.entry
      },
      policy: {
        eligible: true,
        allowanceDefinitionId: ids.effect,
        allowanceMaximum: 1,
        allowanceRefreshBoundary: 'START_OF_TURN' as const,
        selectionPolicy: 'CHOICE' as const,
        choiceDefinitionId: ids.source,
        targetPolicy: 'MOVER' as const
      },
      eligibilityEvidenceChecksum: checksum('a'),
      authority: { kind: 'CHARACTER_CONTROLLER' as const, characterId: ids.characterTwo },
      visibility: 'CONTROLLER' as const
    },
    allowance: { definitionId: ids.effect, maximum: 1, beforeUsed: 0, afterUsed: 1 },
    execution: completedExecution().execution,
    application: {
      kind: 'CHARACTER_MECHANICS_BATCH' as const,
      sourceApplications: [],
      actionEconomyTransition: null,
      schemaVersion: 1 as const,
      occurrenceId: ids.occurrence,
      sourceActorId: ids.actorTwo,
      sourceCharacterId: ids.characterTwo,
      targetActorId: ids.actor,
      sourceCharacterStreamVersion: sourceResourceOnly ? 5 : null,
      targetCharacterStreamVersion: 6,
      resourceConsumption: sourceResourceOnly
        ? {
            poolId: 'reaction-resource',
            chargeId: 'reaction-charge',
            cost: 1,
            beforeUsed: 0,
            afterUsed: 1,
            beforeRemaining: 1,
            afterRemaining: 0
          }
        : null,
      spellCastConsumption: null,
      featureResourceConsumption: null,
      targetFeatureResourceConsumption: null,
      activeEffectTransitions: [],
      maintenanceTransition: null,
      d20: null,
      nestedD20: null,
      stateEffectTransitions: [],
      targetTransition: { checksum: checksum('2'), before, after },
      applications: [
        {
          ordinal: 0,
          kind: 'DAMAGE' as const,
          requestedAmount: 1,
          resolvedAmount: 1,
          appliedAmount: 1,
          beforeCurrentHitPoints: 9,
          afterCurrentHitPoints: 8,
          beforeTemporaryHitPoints: 0,
          afterTemporaryHitPoints: 0,
          maximumHitPoints: 10,
          damageTypeId: ids.effect,
          damageDisposition: 'NORMAL' as const,
          incomingHalved: false,
          critical: false,
          sourceNodeId: 'reaction',
          sourceOperationKey: 'reaction.apply',
          authoredPath: null,
          resolvedPath: null
        }
      ]
    },
    characterTransitions: [
      { characterId: ids.character, beforeStreamVersion: 5, afterStreamVersion: 6 },
      ...(sourceResourceOnly
        ? [{ characterId: ids.characterTwo, beforeStreamVersion: 4, afterStreamVersion: 5 }]
        : [])
    ]
  })
}

function bridgedSpatialResult(sourceResourceOnly = false) {
  const first = completedExecution(0, 5)
  first.targetTransition.after.currentHitPoints = 9
  const second = completedExecution(1, 7, ids.effectTwo)
  second.candidate.target.streamVersion = 6
  second.targetTransition.before.currentHitPoints = 8
  second.targetTransition.after.currentHitPoints = 7
  return {
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
    reactionExecutions: [reactionExecution(sourceResourceOnly)],
    terminalPosition: { x: 10, y: 0 },
    executions: [first, second],
    spatialEffectTransitions: [spatialEffectTransition(), spatialEffectTransition(ids.effectTwo)],
    characterTransitions: [
      {
        characterId: ids.character,
        targetActorId: ids.actor,
        beforeStreamVersion: 4,
        afterStreamVersion: 7,
        before: first.targetTransition.before,
        after: second.targetTransition.after
      }
    ],
    encounterActorTransitions: []
  }
}

function encounterActorResourceReaction(): ReturnType<
  typeof movementReactionActionExecutionDtoSchema.parse
> {
  const reaction = reactionExecution(true)
  const target = {
    currentHitPoints: 10,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    scalarValues: {},
    conditionIds: [],
    deathSaves: NO_DEATH_SAVES
  }
  return movementReactionActionExecutionDtoSchema.parse({
    ...reaction,
    option: {
      ...reaction.option,
      candidate: { ...reaction.option.candidate, movingActorId: ids.source }
    },
    application: {
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH' as const,
      sourceApplications: [],
      actionEconomyTransition: null,
      schemaVersion: 1 as const,
      occurrenceId: ids.occurrence,
      sourceActorId: ids.actorTwo,
      targetActorId: ids.source,
      sourceCharacterStreamVersion: 5,
      resourceConsumption: {
        poolId: 'reaction-resource',
        chargeId: 'reaction-charge',
        cost: 1,
        beforeUsed: 0,
        afterUsed: 1,
        beforeRemaining: 1,
        afterRemaining: 0
      },
      featureResourceConsumption: null,
      targetFeatureResourceConsumption: null,
      d20: null,
      targetTransition: { checksum: checksum('2'), before: target, after: target },
      applications: []
    },
    characterTransitions: [
      { characterId: ids.characterTwo, beforeStreamVersion: 4, afterStreamVersion: 5 }
    ]
  })
}

function lastReactionSpatialEvidenceContext() {
  const completed = completedExecution()
  const prefix = {
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
    reactionExecutions: [],
    terminalPosition: { x: 10, y: 0 },
    executions: [completed],
    spatialEffectTransitions: [spatialEffectTransition()],
    characterTransitions: [],
    encounterActorTransitions: []
  }
  const root = pendingContext().root
  return {
    kind: 'ENCOUNTER_MOVEMENT_REACTION' as const,
    schemaVersion: 1 as const,
    root: { ...root, pathStartDistance: 7, currentPosition: { x: 7, y: 0 } },
    spatialSelectionChecksum: checksum('4'),
    spatialCurrentnessChecksum: checksum('5'),
    reactionSelectionChecksum: checksumRuleDocument([]),
    completedSpatialExecutions: [completed],
    appliedSpatialPrefix: prefix,
    completedReactionExecutions: [reactionExecution()],
    phase: {
      kind: 'SPATIAL_EVIDENCE' as const,
      currentCandidate: pendingCandidate(1, 7, ids.effectTwo)
    },
    remainingSpatialCandidates: [],
    reactionTimeline: []
  }
}

function movementReactionActionPendingContext(): MovementReactionActionPendingContext {
  const option = reactionExecution().option
  const reactionTimeline = [
    {
      kind: 'CONTROLLER_CHOICE' as const,
      group: {
        pathDistance: option.candidate.pathDistance,
        reactorActorId: option.candidate.reactorActorId,
        reactorTokenId: option.candidate.reactorTokenId,
        options: [option]
      }
    }
  ]
  const parsed = serverRuleExecutionPendingApplicationContextDtoSchema.parse({
    kind: 'ENCOUNTER_MOVEMENT_REACTION' as const,
    schemaVersion: 1 as const,
    root: {
      ...pendingContext().root,
      pathStartDistance: option.candidate.pathDistance,
      currentPosition: option.candidate.contact
    },
    spatialSelectionChecksum: checksum('4'),
    spatialCurrentnessChecksum: checksum('5'),
    reactionSelectionChecksum: checksumRuleDocument(reactionTimeline),
    completedSpatialExecutions: [],
    completedReactionExecutions: [],
    phase: {
      kind: 'ACTION_EVIDENCE' as const,
      selectedOptionId: option.optionId,
      rollerActorId: option.candidate.reactorActorId,
      d20Policy: null
    },
    remainingSpatialCandidates: [],
    reactionTimeline
  })
  if (
    parsed.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    !isMovementReactionActionPendingContext(parsed)
  )
    throw new Error('Expected movement reaction action pending context.')
  return parsed
}

function movementReactionLegendaryPendingContext() {
  const context = movementReactionActionPendingContext()
  const originalExecution = structuredClone(completedExecution().execution)
  originalExecution.outputs = { resultPath: 'ON_SAVE_FAIL' }
  originalExecution.evidence.outputs = { resultPath: 'ON_SAVE_FAIL' }
  const originalD20 = {
    requestId: 'movement-reaction-save',
    rollMode: 'NORMAL' as const,
    keep: 'FIRST' as const,
    derivedRollMode: 'NORMAL' as const,
    rawFaces: [5],
    selectedNatural: 5,
    contributors: [],
    contributorChecksum: checksumRuleDocument([]),
    modifier: 0,
    total: 5,
    defenseOrDc: 10,
    resultPath: 'ON_SAVE_FAIL' as const
  }
  const selectionEvidence = {
    targetActorId: ids.actor,
    ownerFeatureId: 'legendary-resistance',
    chargeId: 'resistance-use',
    featureCost: 1,
    definitionId: ids.effect,
    definitionVersion: 1,
    definitionChecksum: checksum('a'),
    choiceGraphDefinitionId: ids.effectTwo,
    choiceGraphDefinitionVersion: 1,
    choiceGraphDefinitionChecksum: checksum('b')
  }
  const selectionChecksum = checksumRuleDocument(selectionEvidence)
  return {
    ...context,
    phase: {
      kind: 'LEGENDARY_RESISTANCE_CHOICE' as const,
      selectedOptionId: context.phase.selectedOptionId,
      originalExecution,
      originalD20,
      originalExecutionChecksum: checksumRuleDocument(originalExecution),
      targetStateChecksum: checksum('2'),
      resistance: {
        ...selectionEvidence,
        poolBefore: 1,
        poolRemaining: 0,
        useOutput: 'use',
        useOptionId: checksumRuleDocument({ kind: 'USE', selectionChecksum }),
        selectionChecksum
      }
    }
  }
}

function maintainedReactionExecution() {
  const reaction = structuredClone(reactionExecution())
  if (reaction.application.kind !== 'CHARACTER_MECHANICS_BATCH')
    throw new Error('Expected Character reaction application.')
  const ownerId = (ordinal: number) =>
    `00000000-0000-4000-8000-${ordinal.toString().padStart(12, '0')}`
  const owners = [ids.character, ownerId(602), ownerId(603)]
  const maintainedStateId = ownerId(501)
  reaction.application.activeEffectTransitions = [
    {
      kind: 'CREATE',
      activeEffectId: ownerId(503),
      characterId: ids.character,
      sourceEncounterId: ids.encounter,
      createdOrdinal: 1,
      afterVersion: 1,
      authoredEffectId: ids.effect,
      compiledEntryId: ids.entry,
      frozenGraphNodeId: 'reaction',
      definitionChecksum: checksum('a'),
      lifecycleChecksum: checksum('b'),
      frozenSourceChecksum: checksum('c'),
      capabilityContractVersion: 1,
      recurrenceStage: 'START_OF_TURN',
      remainingTicks: 2,
      maintainedEffectStateId: maintainedStateId
    }
  ]
  reaction.application.maintenanceTransition = {
    kind: 'REPLACE_SAME_DEFINITION',
    priorState: {
      id: ownerId(504),
      version: 1,
      maintenanceDefinitionId: ownerId(502),
      descriptorChecksum: checksum('d'),
      sourceActorId: ids.actorTwo
    },
    removedDependentEffects: owners.map((characterId, index) => ({
      kind: 'CHARACTER' as const,
      characterId,
      activeEffectId: ownerId(701 + index),
      createdOrdinal: index + 1,
      expectedVersion: 1,
      definitionChecksum: checksum('e'),
      lifecycleChecksum: checksum('f')
    })),
    endedCarriedGrants: [],
    createdState: {
      id: maintainedStateId,
      version: 1,
      maintenanceDefinitionId: ownerId(502),
      descriptorChecksum: checksum('1'),
      definitionChecksum: checksum('2'),
      sourceActionId: 'reaction-action',
      sourceOccurrenceId: ids.occurrence,
      sourceActorId: ids.actorTwo
    },
    characterOwnerTransitions: owners.map((characterId) =>
      characterId === ids.character
        ? { characterId, beforeStreamVersion: 5, afterStreamVersion: 6 }
        : { characterId, beforeStreamVersion: 10, afterStreamVersion: 11 }
    ),
    createdDependentEffectIds: [ownerId(503)]
  }
  reaction.characterTransitions = [
    { characterId: ids.character, beforeStreamVersion: 5, afterStreamVersion: 6 },
    ...reaction.application.maintenanceTransition.characterOwnerTransitions.filter(
      (transition) => transition.characterId !== ids.character
    )
  ]
  const detachedState = {
    currentHitPoints: 10,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    scalarValues: {},
    conditionIds: [],
    deathSaves: NO_DEATH_SAVES
  }
  const targetAfter = structuredClone(reaction.application.targetTransition.after)
  reaction.maintenanceOwnerTransitions = owners.map((characterId, index) => ({
    targetActorId: characterId === ids.character ? ids.actor : ownerId(802 + index),
    characterId,
    before: characterId === ids.character ? structuredClone(targetAfter) : detachedState,
    after: characterId === ids.character ? structuredClone(targetAfter) : detachedState
  }))
  return reaction
}

function concentrationContext(input: {
  damageSource: { kind: 'SPATIAL' | 'REACTION'; executionOrdinal: number }
  finalizedDamageEnvelopeChecksum: string
}) {
  return {
    kind: 'ENCOUNTER_DAMAGE_SAVE_CHECK' as const,
    schemaVersion: 1 as const,
    source: 'CONCENTRATION' as const,
    parentOccurrenceId: ids.occurrence,
    parentCommandFingerprint: checksum('3'),
    finalizedDamageEnvelopeChecksum: input.finalizedDamageEnvelopeChecksum,
    sourceLabels: [],
    trigger: { sourceLabel: null, damageTypeLabel: null, dc: 10 },
    application: {
      ordinal: 0,
      sourceNodeId: input.damageSource.kind === 'SPATIAL' ? 'effect' : 'reaction',
      sourceOperationKey: input.damageSource.kind === 'SPATIAL' ? 'effect.apply' : 'reaction.apply',
      targetActorId: ids.actor,
      appliedAmount: 1,
      damageTypeId: ids.effect
    },
    maintainedState: {
      id: ids.effectTwo,
      version: 1,
      maintenanceDefinitionId: ids.entry,
      descriptorChecksum: checksum('a')
    },
    concentrationDefinition: { id: ids.effectTwo, checksum: checksum('e') },
    save: {
      savingThrowAbilityDefinitionId: ids.entry,
      modifier: 0,
      rollMode: 'ADVANTAGE' as const,
      keep: 'HIGHER' as const,
      contributors: [],
      contributorChecksum: checksumRuleDocument([])
    },
    targetCharacter: {
      streamVersion: 4,
      baseProjectionChecksum: checksum('f'),
      campaignOverlayChecksum: checksum('1'),
      mechanicalContextChecksum: checksum('2')
    },
    systemVocabularySnapshot: { id: ids.encounter, version: 1, checksum: checksum('3') },
    contextChecksum: checksum('4'),
    remaining: []
  }
}

function completedSpatialDamageExecution() {
  const completed = completedExecution()
  const outputs = {
    applicationCandidate: true,
    authorized: true,
    targetActorId: ids.actor,
    targetStateChecksum: checksum('2'),
    amount: 1,
    damageTypeId: ids.effect
  }
  return spatialMovementExecutionDtoSchema.parse({
    ...completed,
    execution: {
      ...completed.execution,
      outputs,
      evidence: {
        ...completed.execution.evidence,
        outputs,
        trace: [{ ...completed.execution.evidence.trace[0]!, outputs }]
      }
    },
    targetTransition: {
      ...completed.targetTransition,
      after: { ...completed.targetTransition.after, currentHitPoints: 9 }
    },
    applications: [
      {
        ordinal: 0,
        kind: 'DAMAGE',
        requestedAmount: 1,
        resolvedAmount: 1,
        appliedAmount: 1,
        beforeCurrentHitPoints: 10,
        afterCurrentHitPoints: 9,
        beforeTemporaryHitPoints: 0,
        afterTemporaryHitPoints: 0,
        maximumHitPoints: 10,
        damageTypeId: ids.effect,
        damageDisposition: 'NORMAL',
        incomingHalved: false,
        critical: false,
        sourceNodeId: 'effect',
        sourceOperationKey: 'effect.apply',
        authoredPath: null,
        resolvedPath: null
      }
    ]
  })
}

function movementConcentrationPendingContext(
  kind: 'SPATIAL' | 'REACTION'
): MovementConcentrationPendingContext {
  const context = movementReactionActionPendingContext()
  const prepared =
    kind === 'SPATIAL'
      ? (() => ({ execution: completedSpatialDamageExecution(), root: pendingContext().root }))()
      : (() => {
          const execution = reactionExecution()
          return {
            execution,
            root: {
              ...context.root,
              pathStartDistance: execution.option.candidate.pathDistance,
              currentPosition: execution.option.candidate.contact
            }
          }
        })()
  const { execution, root } = prepared
  const { concentrationChecks: _concentrationChecks, ...damageEnvelope } = execution
  const parsed = serverRuleExecutionPendingApplicationContextDtoSchema.parse({
    ...context,
    root,
    reactionSelectionChecksum: checksumRuleDocument([]),
    completedSpatialExecutions: kind === 'SPATIAL' ? [execution] : [],
    completedReactionExecutions: kind === 'REACTION' ? [execution] : [],
    phase: {
      kind: 'CONCENTRATION_EVIDENCE',
      damageSource: { kind, executionOrdinal: 0 },
      concentration: concentrationContext({
        damageSource: { kind, executionOrdinal: 0 },
        finalizedDamageEnvelopeChecksum: checksumRuleDocument(damageEnvelope)
      })
    },
    reactionTimeline: []
  })
  if (
    parsed.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    !isMovementConcentrationPendingContext(parsed)
  )
    throw new Error('Expected movement concentration pending context.')
  return parsed
}

function movementConcentrationChildSnapshot() {
  const applicationContext = serverRuleExecutionPendingApplicationContextDtoSchema.parse(
    movementConcentrationPendingContext('SPATIAL')
  )
  if (
    applicationContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    applicationContext.phase.kind !== 'CONCENTRATION_EVIDENCE'
  )
    throw new Error('Expected movement concentration application context.')

  const concentrationDefinition = applicationContext.phase.concentration.concentrationDefinition
  return serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
    snapshotKind: 'KERNEL_EVIDENCE',
    schemaVersion: 1,
    occurrenceId: ids.commandTwo,
    graph: {
      schemaVersion: 1,
      source: {
        definitionId: concentrationDefinition.id,
        gameSystemId: ids.encounter,
        definitionFamilyKey: 'concentration',
        checksum: concentrationDefinition.checksum
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [
        { id: 'roll', operation: { key: 'concentration.save', contractVersion: 1 }, inputs: {} }
      ],
      outputs: { result: { kind: 'NODE_OUTPUT', nodeId: 'roll', port: 'value' } }
    },
    facts: {},
    nextNodeIndex: 0,
    nodeOutputs: {},
    trace: [],
    request: {
      requestId: 'concentration-save',
      kind: 'INTEGER_RANGE',
      nodeId: 'roll',
      ordinal: 0,
      min: 1,
      max: 20
    },
    authority: 'APPLICATION_SERVICE',
    redaction: 'SERVER_ONLY',
    applicationContext
  })
}

describe('spatial movement rule contracts', () => {
  it('binds pending movement concentration evidence to its final spatial or reaction damage', () => {
    const spatial = movementConcentrationPendingContext('SPATIAL')
    const reaction = movementConcentrationPendingContext('REACTION')
    const parsedSpatial = serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(spatial)
    expect(parsedSpatial.success).toBe(true)
    expect(serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(reaction).success).toBe(
      true
    )

    const child = movementConcentrationChildSnapshot()
    expect(child.occurrenceId).toBe(ids.commandTwo)
    expect(serverRuleExecutionPendingOccurrenceId(child)).toBe(ids.occurrence)
    expect(
      serverKernelRuleExecutionPendingSnapshotDtoSchema.safeParse({
        ...child,
        occurrenceId: ids.occurrence
      }).success
    ).toBe(false)
    expect(
      serverKernelRuleExecutionPendingSnapshotDtoSchema.safeParse({
        ...child,
        graph: {
          ...child.graph,
          source: { ...child.graph.source, checksum: checksum('0') }
        }
      }).success
    ).toBe(false)

    const sameContactSpatial = structuredClone(spatial)
    sameContactSpatial.remainingSpatialCandidates = [pendingCandidate(1, 5, ids.effectTwo)]
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(sameContactSpatial).success
    ).toBe(true)
    const sameContactReaction = structuredClone(reaction)
    sameContactReaction.remainingSpatialCandidates = [pendingCandidate(0, 6)]
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(sameContactReaction).success
    ).toBe(false)

    for (const invalid of [
      {
        ...spatial,
        phase: { ...spatial.phase, damageSource: { kind: 'SPATIAL' as const, executionOrdinal: 1 } }
      },
      {
        ...reaction,
        phase: {
          ...reaction.phase,
          concentration: {
            ...reaction.phase.concentration,
            finalizedDamageEnvelopeChecksum: checksum('0')
          }
        }
      },
      {
        ...spatial,
        completedSpatialExecutions: [
          {
            ...spatial.completedSpatialExecutions[0]!,
            execution: {
              ...spatial.completedSpatialExecutions[0]!.execution,
              evidence: {
                ...spatial.completedSpatialExecutions[0]!.execution.evidence,
                source: {
                  ...spatial.completedSpatialExecutions[0]!.execution.evidence.source,
                  checksum: checksum('0')
                }
              }
            }
          }
        ]
      },
      {
        ...spatial,
        completedSpatialExecutions: []
      },
      {
        ...reaction,
        phase: {
          ...reaction.phase,
          concentration: {
            ...reaction.phase.concentration,
            parentCommandFingerprint: checksum('0')
          }
        }
      }
    ])
      expect(serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(invalid).success).toBe(
        false
      )
  })

  it('retains optional movement maintenance preflight only when supplied', () => {
    const historical = serverRuleExecutionPendingApplicationContextDtoSchema.parse(
      movementReactionActionPendingContext()
    )
    if (historical.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error('Expected movement reaction pending context.')
    expect(historical.phase).not.toHaveProperty('maintenanceCurrentnessChecksum')

    const maintenanceCurrentnessChecksum = checksum('6')
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...movementReactionActionPendingContext(),
        phase: {
          ...movementReactionActionPendingContext().phase,
          maintenanceCurrentnessChecksum
        }
      })
    ).toMatchObject({ phase: { maintenanceCurrentnessChecksum } })

    const historicalLegendary = serverRuleExecutionPendingApplicationContextDtoSchema.parse(
      movementReactionLegendaryPendingContext()
    )
    if (historicalLegendary.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error('Expected movement reaction pending context.')
    expect(historicalLegendary.phase).not.toHaveProperty('maintenanceCurrentnessChecksum')
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...movementReactionLegendaryPendingContext(),
        phase: {
          ...movementReactionLegendaryPendingContext().phase,
          maintenanceCurrentnessChecksum
        }
      })
    ).toMatchObject({ phase: { maintenanceCurrentnessChecksum } })
  })

  it('retains every maintained Character owner transition on one movement reaction', () => {
    expect(reactionExecution()).not.toHaveProperty('maintenanceOwnerTransitions')
    const reaction = maintainedReactionExecution()
    expect(
      movementReactionActionExecutionDtoSchema.parse(reaction).characterTransitions
    ).toHaveLength(3)

    const missing = structuredClone(reaction)
    missing.characterTransitions.pop()
    expect(() => movementReactionActionExecutionDtoSchema.parse(missing)).toThrow(
      'include each maintained owner transition'
    )

    const duplicate = structuredClone(reaction)
    duplicate.characterTransitions[2] = duplicate.characterTransitions[1]!
    expect(() => movementReactionActionExecutionDtoSchema.parse(duplicate)).toThrow(
      'unique, ordered, and advance exactly once'
    )
  })

  it('retains the owner transition of a Character whose carried grant the reaction ends (D99)', () => {
    const reaction = maintainedReactionExecution()
    if (reaction.application.kind !== 'CHARACTER_MECHANICS_BATCH')
      throw new Error('Expected Character reaction application.')
    const maintenance = reaction.application.maintenanceTransition
    if (!maintenance) throw new Error('Expected a maintenance transition.')
    const [carried] = maintenance.removedDependentEffects.splice(-1)
    if (carried?.kind !== 'CHARACTER') throw new Error('Expected a Character dependent effect.')
    const { kind: _kind, ...grant } = carried
    maintenance.endedCarriedGrants = [grant]

    expect(
      movementReactionActionExecutionDtoSchema.parse(structuredClone(reaction))
        .maintenanceOwnerTransitions
    ).toHaveLength(3)

    maintenance.endedCarriedGrants = []
    expect(() => movementReactionActionExecutionDtoSchema.parse(reaction)).toThrow(
      'match removed owners'
    )
  })

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

  it('records an entered blocker position only for a won contest that ends the move', () => {
    const command = passageTerminalCommand()
    const {
      terminalPassageStop: _terminalPassageStop,
      terminalPosition: _terminalPosition,
      ...audit
    } = command.passageContest.audit
    const entered = (passageContest: object) =>
      movementRuleResolutionCommandDtoSchema.safeParse({
        ...command,
        passageContest: { ...command.passageContest, ...passageContest }
      }).success
    expect(entered({ audit: { ...audit, enteredPosition: { x: 3, y: 0 } } })).toBe(true)
    expect(
      entered({ audit: { ...command.passageContest.audit, enteredPosition: { x: 3, y: 0 } } })
    ).toBe(false)
    expect(
      entered({
        outcome: 'TIE_OR_FAILURE',
        defender: {
          ...command.passageContest.defender,
          rawFaces: [20],
          selectedNatural: 20,
          total: 20
        },
        audit: { ...audit, enteredPosition: { x: 3, y: 0 } }
      })
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
        continuation: { redaction: 'SERVER_ONLY' }
      }).success
    ).toBe(false)
  })

  it('retains only the exact deleted spatial roots required by frozen contacts', () => {
    const definition = {
      schemaVersion: 2 as const,
      linkedEffectId: null,
      originLevel: null,
      stateContributions: [],
      origin: {
        kind: 'ENCOUNTER' as const,
        sourceActorId: null,
        sourceAggregateId: ids.encounter,
        sourceOccurrenceId: ids.occurrence,
        rootCommandId: ids.command
      },
      authoredEffectId: ids.source,
      compiledEntryId: ids.entry,
      frozenGraphNodeId: 'effect',
      frozenGraph: {
        schemaVersion: 1 as const,
        source: {
          definitionId: ids.source,
          gameSystemId: ids.encounter,
          definitionFamilyKey: 'effect',
          checksum: checksum('e')
        },
        capabilityContractVersion: 1,
        factContracts: [],
        nodes: [
          {
            id: 'effect',
            operation: { key: 'effect.apply', contractVersion: 1 },
            inputs: { value: { kind: 'LITERAL' as const, value: 1 } }
          }
        ],
        outputs: { value: { kind: 'LITERAL' as const, value: 1 } },
        sourceEntryBindings: [{ sourceEntryId: ids.entry, nodeId: 'effect' }]
      },
      adapterFacts: {},
      perceptionContributions: [],
      recurrence: {
        recurrenceStage: 'NONE' as const,
        anchor: 'HOLDER' as const,
        consumeOnFirstEvents: [],
        endOnEvents: [],
        endOnTriggers: [],
        endOnConditionIds: [],
        holderEnd: null,
        lifetimeScope: 'ENCOUNTER' as const,
        expiration: { kind: 'INDEFINITE' as const }
      }
    }
    const lifecycle = { schemaVersion: 1 as const, remainingTicks: null }
    const placement = {
      schemaVersion: 1 as const,
      anchorKind: 'FIXED' as const,
      sourceTokenId: null,
      geometry: {
        frame: 'SCENE_ABSOLUTE' as const,
        shape: { kind: 'CIRCLE' as const, center: { x: 5, y: 0 }, radius: 1 }
      },
      triggerModes: ['ENTER' as const],
      movementKinds: ['VOLUNTARY' as const],
      activation: 'ONE_SHOT' as const,
      visibility: 'PUBLIC' as const,
      revealOnTrigger: false
    }
    const spatialState = { schemaVersion: 1 as const, revealed: true }
    const record = encounterSpatialRuleEffectRecordSchema.parse({
      id: ids.effect,
      encounterId: ids.encounter,
      sceneId: ids.scene,
      maintainedEffectStateId: null,
      createdOrdinal: 1,
      version: 2,
      definition,
      definitionChecksum: checksumRuleDocument(definition),
      lifecycle,
      lifecycleChecksum: checksumRuleDocument(lifecycle),
      placement,
      placementChecksum: checksumRuleDocument(placement),
      spatialState,
      spatialStateChecksum: checksumRuleDocument(spatialState),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    const prefix = lastReactionSpatialEvidenceContext().appliedSpatialPrefix
    const valid = {
      ...prefix,
      executions: prefix.executions.map((execution) => ({
        ...execution,
        candidate: {
          ...execution.candidate,
          effect: {
            ...execution.candidate.effect,
            version: record.version,
            definitionChecksum: record.definitionChecksum,
            lifecycleChecksum: record.lifecycleChecksum,
            placementChecksum: record.placementChecksum,
            spatialStateChecksum: record.spatialStateChecksum,
            authoredEffectId: record.definition.authoredEffectId,
            compiledEntryId: record.definition.compiledEntryId,
            frozenGraphNodeId: record.definition.frozenGraphNodeId,
            frozenSourceChecksum: record.definition.frozenGraph.source.checksum,
            capabilityContractVersion: record.definition.frozenGraph.capabilityContractVersion,
            activation: 'ONE_SHOT' as const,
            revealed: true,
            revealOnTrigger: false
          }
        }
      })),
      spatialEffectTransitions: [
        {
          effectId: ids.effect,
          transition: {
            kind: 'DELETE' as const,
            expectedVersion: record.version,
            definitionChecksum: record.definitionChecksum,
            lifecycleChecksum: record.lifecycleChecksum,
            placementChecksum: record.placementChecksum,
            spatialStateChecksum: record.spatialStateChecksum
          }
        }
      ],
      consumedSpatialEffects: [record]
    }
    expect(storedRuleExecutionResultDtoSchema.safeParse(valid).success).toBe(true)

    const forgedGraph = structuredClone(valid)
    forgedGraph.consumedSpatialEffects[0]!.definition.frozenGraph.source.checksum = checksum('0')
    const forgedBody = structuredClone(valid)
    forgedBody.consumedSpatialEffects[0]!.definition.adapterFacts = { altered: true }
    expect(
      encounterSpatialRuleEffectRecordSchema.safeParse(forgedBody.consumedSpatialEffects[0]).success
    ).toBe(true)
    const nonDelete = {
      ...valid,
      spatialEffectTransitions: [
        {
          effectId: ids.effect,
          transition: {
            kind: 'UNCHANGED' as const,
            expectedVersion: record.version,
            definitionChecksum: record.definitionChecksum,
            lifecycleChecksum: record.lifecycleChecksum,
            placementChecksum: record.placementChecksum,
            spatialStateChecksum: record.spatialStateChecksum
          }
        }
      ]
    }
    const wrongScope = structuredClone(valid)
    wrongScope.consumedSpatialEffects[0]!.sceneId = ids.encounter
    const unrelated = structuredClone(valid)
    unrelated.consumedSpatialEffects[0]!.id = ids.effectTwo
    for (const invalid of [forgedGraph, forgedBody, nonDelete, wrongScope, unrelated])
      expect(storedRuleExecutionResultDtoSchema.safeParse(invalid).success).toBe(false)
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

  it('proves spatial-reaction-spatial Character receipt bridges', () => {
    const bridged = bridgedSpatialResult()
    expect(storedRuleExecutionResultDtoSchema.safeParse(bridged).success).toBe(true)

    const maintained = bridgedSpatialResult()
    maintained.reactionExecutions = [maintainedReactionExecution()]
    expect(storedRuleExecutionResultDtoSchema.safeParse(maintained).success).toBe(true)

    const omittedCleanup = structuredClone(maintained)
    Reflect.deleteProperty(omittedCleanup.reactionExecutions[0]!, 'maintenanceOwnerTransitions')
    expect(storedRuleExecutionResultDtoSchema.safeParse(omittedCleanup).success).toBe(false)

    const wrongMaintenanceSpan = structuredClone(maintained)
    const wrongSpanApplication = wrongMaintenanceSpan.reactionExecutions[0]!.application
    if (wrongSpanApplication.kind !== 'CHARACTER_MECHANICS_BATCH')
      throw new Error('Expected Character mechanics reaction fixture.')
    wrongSpanApplication.maintenanceTransition!.characterOwnerTransitions[0] = {
      characterId: ids.character,
      beforeStreamVersion: 6,
      afterStreamVersion: 7
    }
    wrongMaintenanceSpan.reactionExecutions[0]!.characterTransitions[0] = {
      characterId: ids.character,
      beforeStreamVersion: 6,
      afterStreamVersion: 7
    }
    expect(storedRuleExecutionResultDtoSchema.safeParse(wrongMaintenanceSpan).success).toBe(false)

    const staleCleanup = structuredClone(maintained)
    const staleState = staleCleanup.reactionExecutions[0]!.maintenanceOwnerTransitions![0]!
    staleState.before.currentHitPoints = 9
    staleState.after.currentHitPoints = 9
    expect(storedRuleExecutionResultDtoSchema.safeParse(staleCleanup).success).toBe(false)

    const missingBridge = structuredClone(bridged)
    missingBridge.reactionExecutions = []
    expect(storedRuleExecutionResultDtoSchema.safeParse(missingBridge).success).toBe(false)

    const changedBridge = structuredClone(bridged)
    const changedApplication = changedBridge.reactionExecutions[0]!.application
    if (changedApplication.kind !== 'CHARACTER_MECHANICS_BATCH')
      throw new Error('Expected Character mechanics reaction fixture.')
    changedApplication.targetTransition.before.currentHitPoints = 10
    expect(storedRuleExecutionResultDtoSchema.safeParse(changedBridge).success).toBe(false)

    const scalarBridge = structuredClone(bridged)
    const scalarApplication = scalarBridge.reactionExecutions[0]!.application
    if (scalarApplication.kind !== 'CHARACTER_MECHANICS_BATCH')
      throw new Error('Expected Character mechanics reaction fixture.')
    scalarApplication.targetTransition.after.scalarValues = {
      [ids.entry]: 1
    }
    expect(storedRuleExecutionResultDtoSchema.safeParse(scalarBridge).success).toBe(false)

    const versionGap = structuredClone(bridged)
    const versionApplication = versionGap.reactionExecutions[0]!.application
    if (versionApplication.kind !== 'CHARACTER_MECHANICS_BATCH')
      throw new Error('Expected Character mechanics reaction fixture.')
    versionApplication.targetCharacterStreamVersion = 7
    versionGap.reactionExecutions[0]!.characterTransitions[0]!.beforeStreamVersion = 6
    versionGap.reactionExecutions[0]!.characterTransitions[0]!.afterStreamVersion = 7
    versionGap.executions[1]!.candidate.target.streamVersion = 7
    versionGap.characterTransitions[0]!.afterStreamVersion = 8
    expect(storedRuleExecutionResultDtoSchema.safeParse(versionGap).success).toBe(false)

    const netZeroAcrossGroups = structuredClone(bridged)
    netZeroAcrossGroups.executions[1]!.targetTransition.after.currentHitPoints = 10
    netZeroAcrossGroups.characterTransitions[0]!.after =
      netZeroAcrossGroups.executions[1]!.targetTransition.after
    expect(storedRuleExecutionResultDtoSchema.safeParse(netZeroAcrossGroups).success).toBe(true)

    expect(storedRuleExecutionResultDtoSchema.safeParse(bridgedSpatialResult(true)).success).toBe(
      true
    )

    const spatial = completedExecution()
    spatial.targetTransition.after.currentHitPoints = 9
    expect(
      storedRuleExecutionResultDtoSchema.safeParse({
        ...bridgedSpatialResult(),
        reactionExecutions: [encounterActorResourceReaction()],
        executions: [spatial],
        spatialEffectTransitions: [spatialEffectTransition()],
        characterTransitions: [
          {
            characterId: ids.character,
            targetActorId: ids.actor,
            beforeStreamVersion: 4,
            afterStreamVersion: 5,
            before: spatial.targetTransition.before,
            after: spatial.targetTransition.after
          }
        ]
      }).success
    ).toBe(true)

    const trailingReaction = structuredClone(bridged)
    const resourceOnly = encounterActorResourceReaction()
    resourceOnly.ordinal = 1
    resourceOnly.option.candidate.pathDistance = 8
    trailingReaction.reactionExecutions.push(resourceOnly)
    expect(storedRuleExecutionResultDtoSchema.safeParse(trailingReaction).success).toBe(true)

    const reorderedReactions = structuredClone(bridged)
    reorderedReactions.reactionExecutions[0]!.option.candidate.pathDistance = 7
    reorderedReactions.executions[1]!.candidate.candidate.pathDistance = 8
    const earlierNoOp = encounterActorResourceReaction()
    earlierNoOp.ordinal = 1
    if (earlierNoOp.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
      throw new Error('Expected Encounter actor mechanics reaction fixture.')
    earlierNoOp.application.sourceCharacterStreamVersion = null
    earlierNoOp.application.resourceConsumption = null
    earlierNoOp.characterTransitions = []
    reorderedReactions.reactionExecutions.push(earlierNoOp)
    expect(storedRuleExecutionResultDtoSchema.safeParse(reorderedReactions).success).toBe(false)
  })

  it('binds a reaction mover Character absent from spatial contacts', () => {
    const reaction = structuredClone(reactionExecution())
    reaction.targetCharacterId = ids.characterTwo
    reaction.option = {
      ...reaction.option,
      candidate: {
        ...reaction.option.candidate,
        movingActorId: ids.actorTwo,
        reactorActorId: ids.actor,
        pathDistance: 6
      },
      authority: { kind: 'CHARACTER_CONTROLLER', characterId: ids.character }
    }
    if (reaction.application.kind !== 'CHARACTER_MECHANICS_BATCH')
      throw new Error('Expected Character mechanics reaction fixture.')
    reaction.application.sourceActorId = ids.actor
    reaction.application.sourceCharacterId = ids.character
    reaction.application.targetActorId = ids.actorTwo
    reaction.characterTransitions = [
      { characterId: ids.characterTwo, beforeStreamVersion: 5, afterStreamVersion: 6 }
    ]
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
      reactionExecutions: [reaction],
      terminalPosition: { x: 10, y: 0 },
      executions: [completedExecution()],
      spatialEffectTransitions: [spatialEffectTransition()],
      characterTransitions: [],
      encounterActorTransitions: []
    }
    expect(storedRuleExecutionResultDtoSchema.safeParse(result).success).toBe(true)

    const missingBinding = structuredClone(result)
    Reflect.deleteProperty(missingBinding.reactionExecutions[0]!, 'targetCharacterId')
    expect(storedRuleExecutionResultDtoSchema.safeParse(missingBinding).success).toBe(false)

    const conflictingBinding = structuredClone(result)
    conflictingBinding.reactionExecutions[0]!.targetCharacterId = ids.character
    expect(storedRuleExecutionResultDtoSchema.safeParse(conflictingBinding).success).toBe(false)

    const mismatchedTargetSpan = structuredClone(result)
    const mismatchedApplication = mismatchedTargetSpan.reactionExecutions[0]!.application
    if (mismatchedApplication.kind !== 'CHARACTER_MECHANICS_BATCH')
      throw new Error('Expected Character mechanics reaction fixture.')
    mismatchedApplication.targetCharacterStreamVersion = 7
    expect(storedRuleExecutionResultDtoSchema.safeParse(mismatchedTargetSpan).success).toBe(false)

    expect(storedRuleExecutionResultDtoSchema.safeParse(bridgedSpatialResult()).success).toBe(true)
  })

  it('retains the remaining spatial evidence after the final reaction contact', () => {
    const afterLastReaction = lastReactionSpatialEvidenceContext()
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(afterLastReaction).success
    ).toBe(true)

    const emptyChoice = { ...afterLastReaction, phase: { kind: 'CHOICE' as const } }
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(emptyChoice).success
    ).toBe(false)

    const unprovedEmptySpatial = { ...afterLastReaction, appliedSpatialPrefix: null }
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(unprovedEmptySpatial).success
    ).toBe(false)
  })

  it('retains only the committed spatial prefix while later spatial evidence is pending', () => {
    const pending = lastReactionSpatialEvidenceContext()
    pending.completedSpatialExecutions.push(completedExecution(1, 7, ids.effectTwo))
    pending.phase.currentCandidate = pendingCandidate(2, 7, ids.effect)
    expect(serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(pending).success).toBe(
      true
    )

    const changedPrefix = structuredClone(pending)
    changedPrefix.appliedSpatialPrefix.executions = structuredClone(
      changedPrefix.appliedSpatialPrefix.executions
    )
    changedPrefix.appliedSpatialPrefix.executions[0]!.candidate.target.projectionChecksum =
      checksum('0')
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(changedPrefix).success
    ).toBe(false)

    const nonPrefix = structuredClone(pending)
    nonPrefix.appliedSpatialPrefix.executions = [completedExecution(0, 5, ids.effectTwo)]
    nonPrefix.appliedSpatialPrefix.spatialEffectTransitions = [
      spatialEffectTransition(ids.effectTwo)
    ]
    expect(serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(nonPrefix).success).toBe(
      false
    )

    const actionEvidence = movementReactionActionPendingContext()
    actionEvidence.completedSpatialExecutions = [completedExecution()]
    actionEvidence.appliedSpatialPrefix = lastReactionSpatialEvidenceContext().appliedSpatialPrefix
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(actionEvidence).success
    ).toBe(true)
    actionEvidence.completedSpatialExecutions.push(completedExecution(1, 6, ids.effectTwo))
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(actionEvidence).success
    ).toBe(false)
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

describe('Concentration ends in the spatial movement receipt timeline (D95)', () => {
  const maintainedStateId = ids.entry
  const derivedConditionId = ids.source

  /**
   * Two contacts on one Character with a Concentration end after the first. The end observes the
   * persisted state, which may carry conditions the System derived (D63); the second contact then
   * continues from the end's resulting state.
   */
  function endedSpatialResult(options: { observedConditionIds: string[]; secondChanges: boolean }) {
    const result = bridgedSpatialResult()
    result.reactionExecutions = []
    const [first, second] = result.executions as [
      ReturnType<typeof completedExecution>,
      ReturnType<typeof completedExecution>
    ]
    const observed = { ...first.targetTransition.after, conditionIds: options.observedConditionIds }
    Object.assign(first, {
      concentrationEnd: {
        sourceCommandId: ids.commandTwo,
        result: {
          occurrenceId: ids.effectTwo,
          applicationOutputs: {
            kind: 'CONCENTRATION_END' as const,
            schemaVersion: 1 as const,
            occurrenceId: ids.effectTwo,
            parentOccurrenceId: ids.occurrence,
            ownerActorId: ids.actor,
            maintainedStateId,
            reason: 'DEFEATED' as const,
            cleanup: {
              maintainedStateId,
              removedDependentEffectIds: [],
              removedZoneIds: [],
              characterOwnerTransitions: [
                { characterId: ids.character, beforeStreamVersion: 5, afterStreamVersion: 6 }
              ]
            }
          }
        },
        ownerTransitions: [
          {
            targetActorId: ids.actor,
            characterId: ids.character,
            before: observed,
            after: observed
          }
        ]
      }
    })
    second.candidate.target.streamVersion = 6
    second.targetTransition.before = observed
    second.targetTransition.after = options.secondChanges
      ? { ...observed, currentHitPoints: observed.currentHitPoints - 1 }
      : observed
    const [transition] = result.characterTransitions
    transition!.beforeStreamVersion = 4
    transition!.before = first.targetTransition.before
    if (options.secondChanges) {
      transition!.afterStreamVersion = 7
      transition!.after = second.targetTransition.after
    } else {
      transition!.afterStreamVersion = 5
      transition!.after = first.targetTransition.after
    }
    return result
  }

  const accepts = (result: ReturnType<typeof endedSpatialResult>) =>
    storedRuleExecutionResultDtoSchema.safeParse(result).success

  it('accepts an end that observes the conditions the System derived for the contact', () => {
    expect(accepts(endedSpatialResult({ observedConditionIds: [], secondChanges: false }))).toBe(
      true
    )
    expect(
      accepts(
        endedSpatialResult({ observedConditionIds: [derivedConditionId], secondChanges: false })
      )
    ).toBe(true)
  })

  it('leaves the schema lenient about WHICH extra condition: persistence rejects a forged one', () => {
    // The schema cannot know the System's derivation, so any extra condition is accepted here.
    // `persistLiveMovementConcentrationEnd` binds the owner `before` to the stored state and
    // rejects a forged condition (packages/encounter-persistence concentrationEnd.test.ts).
    expect(
      accepts(endedSpatialResult({ observedConditionIds: [ids.user], secondChanges: false }))
    ).toBe(true)
  })

  it('still rejects an end that observes a different hit point state', () => {
    const result = endedSpatialResult({ observedConditionIds: [], secondChanges: false })
    const end = (
      result.executions[0] as unknown as {
        concentrationEnd: { ownerTransitions: { before: { currentHitPoints: number } }[] }
      }
    ).concentrationEnd
    end.ownerTransitions[0]!.before.currentHitPoints = 3
    expect(accepts(result)).toBe(false)
  })

  it('keeps the span when a later contact changes nothing', () => {
    expect(
      accepts(
        endedSpatialResult({ observedConditionIds: [derivedConditionId], secondChanges: false })
      )
    ).toBe(true)
    // The span must not absorb the no-op contact's state after the end.
    const result = endedSpatialResult({
      observedConditionIds: [derivedConditionId],
      secondChanges: false
    })
    result.characterTransitions[0]!.afterStreamVersion = 6
    expect(accepts(result)).toBe(false)
  })

  it('updates the span when a later contact changes the state', () => {
    const result = endedSpatialResult({
      observedConditionIds: [derivedConditionId],
      secondChanges: true
    })
    expect(accepts(result)).toBe(true)
    // A stale span that ignores the later change is rejected.
    const stale = endedSpatialResult({
      observedConditionIds: [derivedConditionId],
      secondChanges: true
    })
    stale.characterTransitions[0]!.afterStreamVersion = 5
    stale.characterTransitions[0]!.after = (
      stale.executions[0] as ReturnType<typeof completedExecution>
    ).targetTransition.after
    expect(accepts(stale)).toBe(false)
  })
})
