import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { z, lazySchema, lazySchemaParts } from '../zod.js'

import { movementReactionChoiceSelectionDtoSchema } from './reaction.js'
import {
  MAX_SPATIAL_CANDIDATES,
  MAX_SPATIAL_PATH_POINTS,
  spatialMovementCandidateDtoSchema,
  spatialMeleeRetaliationContactDtoSchema,
  spatialMovementKindDtoSchema,
  spatialTurnContactDtoSchema,
  spatialPointDtoSchema
} from './spatialFacts.js'
import { serverRuleExecutionD20PolicyDtoSchema } from './ruleExecutionEvidence.js'
import { d20RolledAddedDiceDtoSchema } from './d20AddedDice.js'
import {
  ruleExecutionCapabilityKeySchema as capabilityKeySchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionContractVersionSchema as contractVersionSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionLocalNodeIdSchema as localNodeIdSchema,
  ruleExecutionNonNegativeIntegerSchema as nonNegativeIntegerSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  rollModeKeepFaceCount,
  rollModeKeepSchema,
  rollModeKeptFace,
  systemCoreCodeSchema
} from './systemCoreCode.js'

const spatialTargetCurrentnessPinDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CHARACTER'),
      characterId: uuidSchema,
      streamVersion: integerSchema.check(z.gte(0)),
      projectionChecksum: checksumSchema,
      mechanicalContextChecksum: checksumSchema,
      targetStateChecksum: checksumSchema
    }),
    z.strictObject({
      kind: z.literal('ENCOUNTER_ACTOR'),
      targetStateChecksum: checksumSchema
    })
  ])
)

const spatialAggregateVersionSchema = lazySchema(() => integerSchema.check(z.gte(0)))

export const spatialEffectCurrentnessPinDtoSchema = lazySchema(() =>
  z.strictObject({
    effectId: uuidSchema,
    version: positiveIntegerSchema,
    definitionChecksum: checksumSchema,
    lifecycleChecksum: checksumSchema,
    placementChecksum: checksumSchema,
    spatialStateChecksum: checksumSchema,
    authoredEffectId: uuidSchema,
    compiledEntryId: uuidSchema,
    frozenGraphNodeId: localNodeIdSchema,
    frozenSourceChecksum: checksumSchema,
    capabilityContractVersion: contractVersionSchema,
    activation: z.enum(['ONE_SHOT', 'REPEATABLE']),
    revealed: z.boolean(),
    revealOnTrigger: z.boolean()
  })
)

/** The resolved d20 of a paused effect now answering its damage dice (a failed save). */
export const resolvedD20StageDtoSchema = lazySchema(() =>
  z.strictObject({
    rollMode: systemCoreCodeSchema,
    keep: rollModeKeepSchema,
    rawFaces: z.array(pendingD20FaceSchema).check(z.minLength(1)).check(z.maxLength(2)),
    addedDice: d20RolledAddedDiceDtoSchema
  })
)

/** What a spatial candidate pins besides its contact: the effect and target currentness and the d20 it waits on. */
const spatialCandidateEvidenceFields = lazySchemaParts(() => ({
  effect: spatialEffectCurrentnessPinDtoSchema,
  target: spatialTargetCurrentnessPinDtoSchema,
  d20Policy: z.nullable(z.lazy(() => serverRuleExecutionD20PolicyDtoSchema)),
  /** The resolved d20 of a candidate now answering its damage dice (a placed zone's failed entry save). */
  diceStage: z.nullable(resolvedD20StageDtoSchema)
}))

const refineSpatialCandidateEffect = (
  value: { candidate: { effectId: string }; effect: { effectId: string } },
  context: z.core.$RefinementCtx
) => {
  if (value.candidate.effectId !== value.effect.effectId)
    context.addIssue({
      code: 'custom',
      path: ['effect', 'effectId'],
      message: 'Spatial candidate and effect currentness identity must agree.'
    })
}

export const spatialPendingCandidateDtoSchema = lazySchema(() =>
  z
    .strictObject({
      ordinal: z
        .number()
        .check(z.int())
        .check(z.gte(0))
        .check(z.lte(MAX_SPATIAL_CANDIDATES - 1)),
      candidate: spatialMovementCandidateDtoSchema,
      ...spatialCandidateEvidenceFields()
    })
    .check(z.superRefine(refineSpatialCandidateEffect))
)

/** One zone a creature stands in at a turn boundary, pinned like a movement contact. */
export const spatialTurnCandidateDtoSchema = lazySchema(() =>
  z
    .strictObject({
      ordinal: z
        .number()
        .check(z.int())
        .check(z.gte(0))
        .check(z.lte(MAX_SPATIAL_CANDIDATES - 1)),
      boundaryOrdinal: integerSchema.check(z.gte(0)).check(z.lte(1)),
      candidate: spatialTurnContactDtoSchema,
      ...spatialCandidateEvidenceFields()
    })
    .check(z.superRefine(refineSpatialCandidateEffect))
)

/** One zone that answers a melee hit, pinned like a turn contact; its dice are always system-rolled. */
export const spatialMeleeRetaliationCandidateDtoSchema = lazySchema(() =>
  z
    .strictObject({
      ordinal: z
        .number()
        .check(z.int())
        .check(z.gte(0))
        .check(z.lte(MAX_SPATIAL_CANDIDATES - 1)),
      candidate: spatialMeleeRetaliationContactDtoSchema,
      ...spatialCandidateEvidenceFields()
    })
    .check(z.superRefine(refineSpatialCandidateEffect))
)

export const pendingD20FaceSchema = lazySchema(() => integerSchema.check(z.gte(1)).check(z.lte(20)))

const movementPassageContestParticipantReceiptDtoSchema = lazySchema(() =>
  z
    .strictObject({
      rollMode: systemCoreCodeSchema,
      keep: rollModeKeepSchema,
      rawFaces: z.array(pendingD20FaceSchema).check(z.minLength(1)).check(z.maxLength(2)),
      selectedNatural: pendingD20FaceSchema,
      modifier: integerSchema,
      total: integerSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (
          value.rawFaces.length !== rollModeKeepFaceCount(value.keep) ||
          value.selectedNatural !== rollModeKeptFace(value.keep, value.rawFaces) ||
          value.total !== value.selectedNatural + value.modifier
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Movement passage contest evidence must match its sealed d20 policy.'
          })
        }
      })
    )
)

export const movementPassageContestReceiptDtoSchema = lazySchema(() =>
  z
    .strictObject({
      actionKind: z.enum(['OVERRUN', 'TUMBLE']),
      optionId: checksumSchema,
      outcome: z.enum(['SUCCESS', 'TIE_OR_FAILURE']),
      initiator: movementPassageContestParticipantReceiptDtoSchema,
      defender: movementPassageContestParticipantReceiptDtoSchema,
      actionEconomy: z.strictObject({
        definitionId: uuidSchema,
        definitionVersion: positiveIntegerSchema,
        definitionChecksum: checksumSchema,
        maximum: positiveIntegerSchema,
        beforeUsed: nonNegativeIntegerSchema,
        afterUsed: positiveIntegerSchema
      }),
      audit: z.strictObject({
        optionalCombat: z.strictObject({
          definitionId: uuidSchema,
          definitionVersion: positiveIntegerSchema,
          definitionChecksum: checksumSchema,
          moduleKey: capabilityKeySchema,
          moduleContractVersion: contractVersionSchema
        }),
        sourceActorId: uuidSchema,
        sourceTokenId: uuidSchema,
        blockerActorId: uuidSchema,
        blockerTokenId: uuidSchema,
        contact: spatialPointDtoSchema,
        contactPathDistance: z.number().check(z.nonnegative()),
        blockerCurrentnessChecksum: checksumSchema,
        selectionContractChecksum: checksumSchema,
        resolvedSelectionChecksum: checksumSchema,
        spatialSelectionChecksum: checksumSchema,
        spatialCurrentnessChecksum: checksumSchema,
        originalPath: z
          .array(spatialPointDtoSchema)
          .check(z.minLength(2))
          .check(z.maxLength(MAX_SPATIAL_PATH_POINTS)),
        pathChecksum: checksumSchema,
        terminalPassageStop: z.optional(
          z.strictObject({
            blockerActorId: uuidSchema,
            blockerTokenId: uuidSchema,
            contact: spatialPointDtoSchema,
            contactPathDistance: z.number().check(z.nonnegative()),
            blockerCurrentnessChecksum: checksumSchema
          })
        ),
        terminalPosition: z.optional(spatialPointDtoSchema)
      })
    })
    .check(
      z.superRefine((value, context) => {
        const success = value.initiator.total > value.defender.total
        if (
          value.actionEconomy.afterUsed !== value.actionEconomy.beforeUsed + 1 ||
          value.actionEconomy.afterUsed > value.actionEconomy.maximum ||
          (success ? value.outcome !== 'SUCCESS' : value.outcome !== 'TIE_OR_FAILURE')
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Movement passage settlement must match its contest and economy evidence.'
          })
        }
        const auditedContact = spatialPathPointAtDistance(
          value.audit.originalPath,
          value.audit.contactPathDistance
        )
        if (
          checksumRuleDocument(value.audit.originalPath) !== value.audit.pathChecksum ||
          auditedContact === null ||
          !spatialPointEquals(auditedContact, value.audit.contact)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['audit', 'originalPath'],
            message: 'Movement passage audit contacts must bind the authoritative root path.'
          })
        }
        const terminalPassageStop = value.audit.terminalPassageStop
        const terminalPosition = value.audit.terminalPosition
        const auditedTerminalContact = terminalPassageStop
          ? spatialPathPointAtDistance(
              value.audit.originalPath,
              terminalPassageStop.contactPathDistance
            )
          : null
        if (
          (terminalPassageStop === undefined) !== (terminalPosition === undefined) ||
          (terminalPassageStop !== undefined &&
            (value.outcome !== 'SUCCESS' ||
              terminalPassageStop.contactPathDistance <= value.audit.contactPathDistance + 1e-8 ||
              auditedTerminalContact === null ||
              !spatialPointEquals(auditedTerminalContact, terminalPassageStop.contact) ||
              terminalPosition === undefined ||
              !spatialPointEquals(terminalPosition, terminalPassageStop.contact)))
        ) {
          context.addIssue({
            code: 'custom',
            path: ['audit', 'terminalPassageStop'],
            message:
              'A terminal passage stop must follow a successful path-bound contact and match the terminal position.'
          })
        }
      })
    )
)

export const spatialResolutionCommandDtoSchema = lazySchema(() =>
  z.strictObject({
    commandId: uuidSchema,
    commandFingerprint: checksumSchema,
    actorUserId: uuidSchema,
    correlationId: z.nullable(uuidSchema),
    expectedOccurrenceVersion: spatialAggregateVersionSchema,
    requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
    kind: z.enum(['ENTER_DICE', 'SYSTEM_ROLL']),
    passageContest: z.optional(movementPassageContestReceiptDtoSchema)
  })
)

const movementResolutionCommandBaseShape = lazySchemaParts(() => ({
  commandId: uuidSchema,
  commandFingerprint: checksumSchema,
  actorUserId: uuidSchema,
  correlationId: z.nullable(uuidSchema),
  expectedOccurrenceVersion: spatialAggregateVersionSchema
}))

/** Action outcome evidence shares the movement occurrence history with dice and choices. */
export const movementReactionActionEvidenceCommandDtoSchema = lazySchema(() =>
  z.union([
    spatialResolutionCommandDtoSchema,
    z.strictObject({
      ...movementResolutionCommandBaseShape(),
      requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
      kind: z.literal('ENTER_INTEGER')
    })
  ])
)

export const movementReactionResolutionCommandDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      ...movementResolutionCommandBaseShape(),
      ...movementReactionChoiceSelectionDtoSchema._zod.def.options[0].shape
    }),
    z.strictObject({
      ...movementResolutionCommandBaseShape(),
      ...movementReactionChoiceSelectionDtoSchema._zod.def.options[1].shape
    })
  ])
)

/** A sealed response to the one movement-passage choice at an occupied contact. */
export const movementPassageResolutionCommandDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      ...movementResolutionCommandBaseShape(),
      kind: z.literal('PASSAGE_DECLINE')
    }),
    z.strictObject({
      ...movementResolutionCommandBaseShape(),
      kind: z.literal('PASSAGE_OPTION'),
      optionId: checksumSchema,
      passageContest: z.optional(movementPassageContestReceiptDtoSchema)
    })
  ])
)

/**
 * One canonical version history for the complete movement occurrence. Spatial
 * evidence and reaction choices advance the same aggregate-owned occurrence;
 * neither creates a second workflow or receipt stream.
 */
export const movementRuleResolutionCommandDtoSchema = lazySchema(() =>
  z.union([
    movementReactionActionEvidenceCommandDtoSchema,
    movementReactionResolutionCommandDtoSchema,
    movementPassageResolutionCommandDtoSchema
  ])
)

export function validateCanonicalSpatialResolutionHistory(
  commands: readonly z.infer<typeof movementRuleResolutionCommandDtoSchema>[],
  context: z.core.$RefinementCtx,
  path: readonly (string | number)[]
) {
  const commandIds = new Set<string>()
  let passageOptionId: string | null = null
  let passageContestRecorded = false
  for (const [index, command] of commands.entries()) {
    if (commandIds.has(command.commandId))
      context.addIssue({
        code: 'custom',
        path: [...path, index, 'commandId'],
        message: 'Movement resolution command IDs must be unique.'
      })
    commandIds.add(command.commandId)
    if (command.kind === 'PASSAGE_OPTION') passageOptionId = command.optionId
    const passageContest = 'passageContest' in command ? command.passageContest : undefined
    if (passageContest) {
      if (
        passageContestRecorded ||
        passageOptionId === null ||
        passageContest.optionId !== passageOptionId ||
        (command.kind === 'PASSAGE_OPTION' && command.optionId !== passageContest.optionId)
      ) {
        context.addIssue({
          code: 'custom',
          path: [...path, index, 'passageContest'],
          message: 'Movement passage contest evidence must bind one prior issued option.'
        })
      }
      passageContestRecorded = true
    }
    if (command.expectedOccurrenceVersion !== index)
      context.addIssue({
        code: 'custom',
        path: [...path, index, 'expectedOccurrenceVersion'],
        message:
          'Movement resolution commands must retain contiguous occurrence versions starting at zero.'
      })
  }
}

export const spatialPointEquals = (
  left: z.infer<typeof spatialPointDtoSchema>,
  right: z.infer<typeof spatialPointDtoSchema>
): boolean => Math.abs(left.x - right.x) <= 1e-8 && Math.abs(left.y - right.y) <= 1e-8

export const spatialPathPointAtDistance = (
  path: readonly z.infer<typeof spatialPointDtoSchema>[],
  distance: number
): z.infer<typeof spatialPointDtoSchema> | null => {
  let remaining = distance
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]!
    const end = path[index]!
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    if (length === 0) continue
    if (remaining <= length + 1e-8) {
      const ratio = Math.max(0, Math.min(1, remaining / length))
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio
      }
    }
    remaining -= length
  }
  return remaining <= 1e-8 ? path[path.length - 1]! : null
}

export const compareSpatialPendingCandidates = (
  left: z.infer<typeof spatialPendingCandidateDtoSchema>,
  right: z.infer<typeof spatialPendingCandidateDtoSchema>
): number => {
  const keys = [
    left.candidate.pathDistance - right.candidate.pathDistance,
    left.candidate.effectId.localeCompare(right.candidate.effectId),
    left.candidate.targetActorId.localeCompare(right.candidate.targetActorId),
    left.candidate.trigger.localeCompare(right.candidate.trigger),
    (left.candidate.step ?? 0) - (right.candidate.step ?? 0)
  ]
  return keys.find((value) => value !== 0) ?? 0
}

export const movementPassageStopDtoSchema = lazySchema(() =>
  z.strictObject({
    blockerActorId: uuidSchema,
    blockerTokenId: uuidSchema,
    contact: spatialPointDtoSchema,
    pathDistance: z.number().check(z.nonnegative()),
    blockerCurrentnessChecksum: checksumSchema
  })
)

export const spatialMovementPendingRootDtoSchema = lazySchema(() =>
  z.strictObject({
    commandId: uuidSchema,
    commandFingerprint: checksumSchema,
    initiatorUserId: uuidSchema,
    correlationId: z.nullable(uuidSchema),
    encounterId: uuidSchema,
    sceneId: uuidSchema,
    tokenId: uuidSchema,
    expectedEncounterVersion: spatialAggregateVersionSchema,
    expectedSceneVersion: spatialAggregateVersionSchema,
    /** Exact Scene version after the last committed paused contact movement. */
    currentSceneVersion: spatialAggregateVersionSchema,
    movementKind: spatialMovementKindDtoSchema,
    originalPath: z
      .array(spatialPointDtoSchema)
      .check(z.minLength(2))
      .check(z.maxLength(MAX_SPATIAL_PATH_POINTS)),
    pathChecksum: checksumSchema,
    pathStartDistance: z.number().check(z.nonnegative()),
    currentPosition: spatialPointDtoSchema,
    terminalPassageStop: z.optional(z.nullable(movementPassageStopDtoSchema)),
    resolutionCommands: z
      .array(movementRuleResolutionCommandDtoSchema)
      .check(z.maxLength(MAX_SPATIAL_CANDIDATES))
  })
)

export function validateSpatialMovementPendingRoot(
  root: z.infer<typeof spatialMovementPendingRootDtoSchema>,
  context: z.core.$RefinementCtx,
  path: readonly (string | number)[]
) {
  if (root.currentSceneVersion < root.expectedSceneVersion)
    context.addIssue({
      code: 'custom',
      path: [...path, 'currentSceneVersion'],
      message: 'Pending spatial Scene currentness may not precede its immutable root version.'
    })
  if (root.movementKind === 'TELEPORT' && root.originalPath.length !== 2)
    context.addIssue({
      code: 'custom',
      path: [...path, 'originalPath'],
      message: 'Teleport spatial movement must retain only origin and destination.'
    })
  if (checksumRuleDocument(root.originalPath) !== root.pathChecksum)
    context.addIssue({
      code: 'custom',
      path: [...path, 'pathChecksum'],
      message: 'Spatial movement path checksum must bind the exact authoritative path.'
    })
  validateCanonicalSpatialResolutionHistory(root.resolutionCommands, context, [
    ...path,
    'resolutionCommands'
  ])
  const committed = spatialPathPointAtDistance(root.originalPath, root.pathStartDistance)
  if (committed === null || !spatialPointEquals(committed, root.currentPosition))
    context.addIssue({
      code: 'custom',
      path: [...path, 'currentPosition'],
      message:
        'Spatial movement current position must be the authoritative path position at pathStartDistance.'
    })
  if (root.terminalPassageStop) {
    const stop = spatialPathPointAtDistance(
      root.originalPath,
      root.terminalPassageStop.pathDistance
    )
    if (
      root.terminalPassageStop.pathDistance + 1e-8 < root.pathStartDistance ||
      stop === null ||
      !spatialPointEquals(stop, root.terminalPassageStop.contact)
    )
      context.addIssue({
        code: 'custom',
        path: [...path, 'terminalPassageStop'],
        message: 'A terminal passage stop must be at or after the committed path contact.'
      })
  }
}
