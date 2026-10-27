import { z, lazySchema } from '../zod.js'

import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules/contributors'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { movementReactionTimelineDtoSchema } from './reaction.js'
import { spatialMovementExecutionDtoSchema } from './ruleExecutionEffectEvidence.js'
import { receiptD20ContributorSchema } from './ruleExecutionEvidence.js'
import { movementReactionActionExecutionDtoSchema } from './ruleExecutionMovementReactionReceipts.js'
import {
  movementPassageStopDtoSchema,
  pendingD20FaceSchema,
  spatialMovementPendingRootDtoSchema,
  spatialPathPointAtDistance,
  spatialPendingCandidateDtoSchema,
  spatialPointEquals,
  validateSpatialMovementPendingRoot
} from './ruleExecutionSpatial.js'
import { storedRuleExecutionResultDtoSchema } from './ruleExecutionResults.js'
import {
  ruleExecutionCapabilityKeySchema as capabilityKeySchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionContractVersionSchema as contractVersionSchema,
  ruleExecutionIdentifierSchema as identifierSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionLocalNodeIdSchema as localNodeIdSchema,
  ruleExecutionNonNegativeIntegerSchema as nonNegativeIntegerSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import { MAX_SPATIAL_CANDIDATES, spatialPointDtoSchema } from './spatialFacts.js'
import { AUTHORED_LIMITS, MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import {
  rollModeKeepFaceCount,
  rollModeKeepSchema,
  systemCoreCodeSchema
} from './systemCoreCode.js'

/** One sealed contest d20 roll: its mode, contributors and modifier. */
const contestD20RollDtoSchema = lazySchema(() =>
  z
    .strictObject({
      rollMode: systemCoreCodeSchema,
      keep: rollModeKeepSchema,
      contributors: z
        .array(receiptD20ContributorSchema)
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
      contributorChecksum: checksumSchema,
      modifier: integerSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (
          value.contributors.some(
            (contributor, index) =>
              index > 0 &&
              compareCanonicalD20Contributors(value.contributors[index - 1]!, contributor) >= 0
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: ['contributors'],
            message: 'Optional-combat contest contributors must be strictly sorted and unique.'
          })
        }
        if (checksumRuleDocument(value.contributors) !== value.contributorChecksum) {
          context.addIssue({
            code: 'custom',
            path: ['contributorChecksum'],
            message: 'Optional-combat contest contributor checksum is invalid.'
          })
        }
      })
    )
)

const contestInitiatorD20PolicyDtoSchema = lazySchema(() =>
  z.extend(contestD20RollDtoSchema, { actorId: uuidSchema, requestNodeId: localNodeIdSchema })
)

/** A check the defender may roll, frozen from its own facts when the contest is sealed (D152). */
const contestDefenderCheckDtoSchema = lazySchema(() =>
  z.extend(contestD20RollDtoSchema, { checkDefinitionId: uuidSchema, label: identifierSchema })
)

const contestDefenderDtoSchema = lazySchema(() =>
  z.strictObject({
    actorId: uuidSchema,
    requestNodeId: localNodeIdSchema,
    checks: z
      .array(contestDefenderCheckDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(AUTHORED_LIMITS.nestedCollectionItems))
  })
)

export type ContestDefenderDto = z.infer<typeof contestDefenderDtoSchema>
export type ContestDefenderCheckDto = z.infer<typeof contestDefenderCheckDtoSchema>

const optionalCombatContestActionEconomyReceiptDtoSchema = lazySchema(() =>
  z.nullable(
    z.strictObject({
      definitionId: uuidSchema,
      definitionVersion: positiveIntegerSchema,
      definitionChecksum: checksumSchema,
      maximum: positiveIntegerSchema,
      beforeUsed: nonNegativeIntegerSchema
    })
  )
)

const contestRollEvidenceDtoSchema = lazySchema(() =>
  z.strictObject({
    requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
    rawFaces: z.array(pendingD20FaceSchema).check(z.minLength(1)).check(z.maxLength(2))
  })
)

const contestDefenderRollEvidenceDtoSchema = lazySchema(() =>
  z.extend(contestRollEvidenceDtoSchema, { checkDefinitionId: uuidSchema })
)

/**
 * Frozen movement suffix retained while a selected Overrun or Tumble contest
 * awaits evidence. It is factual continuation state, never executable graph
 * data; the application resumes the existing spatial/reaction pipeline from it.
 */
export const optionalCombatPassageContinuationDtoSchema = lazySchema(() =>
  z
    .strictObject({
      root: spatialMovementPendingRootDtoSchema,
      blockerActorId: uuidSchema,
      blockerTokenId: uuidSchema,
      contact: spatialPointDtoSchema,
      contactPathDistance: z.number().check(z.nonnegative()),
      blockerCurrentnessChecksum: checksumSchema,
      nextPassageStop: z.optional(z.nullable(movementPassageStopDtoSchema)),
      spatialSelectionChecksum: checksumSchema,
      spatialCurrentnessChecksum: checksumSchema,
      completedSpatialExecutions: z
        .array(z.lazy(() => spatialMovementExecutionDtoSchema))
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      appliedSpatialPrefix: z.nullable(z.lazy(() => storedRuleExecutionResultDtoSchema)),
      completedReactionExecutions: z._default(
        z.array(movementReactionActionExecutionDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        []
      ),
      remainingSpatialCandidates: z
        .array(spatialPendingCandidateDtoSchema)
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      reactionTimeline: movementReactionTimelineDtoSchema
    })
    .check(
      z.superRefine((value, context) => {
        validateSpatialMovementPendingRoot(value.root, context, ['root'])
        if (Math.abs(value.root.pathStartDistance - value.contactPathDistance) > 1e-8) {
          context.addIssue({
            code: 'custom',
            path: ['contactPathDistance'],
            message: 'Passage continuation must begin at its sealed contact distance.'
          })
        }
        if (!spatialPointEquals(value.root.currentPosition, value.contact)) {
          context.addIssue({
            code: 'custom',
            path: ['contact'],
            message: 'Passage continuation contact must match the committed movement position.'
          })
        }
        if (value.nextPassageStop) {
          const stop = spatialPathPointAtDistance(
            value.root.originalPath,
            value.nextPassageStop.pathDistance
          )
          if (
            value.nextPassageStop.pathDistance <= value.contactPathDistance + 1e-8 ||
            stop === null ||
            !spatialPointEquals(stop, value.nextPassageStop.contact)
          )
            context.addIssue({
              code: 'custom',
              path: ['nextPassageStop'],
              message: 'A remaining hostile passage stop must retain canonical path order.'
            })
        }
      })
    )
)

/**
 * A movement passage contest's sealed choice. `successMovement` is what the rule's policy has a won
 * contest do to the movement: pass through the blocker and continue, or end the move inside the
 * blocker's space, stepping in from the contact point (a climb onto a larger creature).
 */
function movementPassageSelectionDtoSchema<
  const TKind extends 'OVERRUN' | 'TUMBLE' | 'CLIMB_ONTO_LARGER_CREATURE'
>(kind: TKind) {
  return z.strictObject({
    kind: z.literal(kind),
    economy: z.enum(['ACTION', 'BONUS_ACTION']),
    initiatorCheckDefinitionId: uuidSchema,
    initiatorCheckLabel: identifierSchema,
    defenderCheckDefinitionId: uuidSchema,
    successMovement: z.enum(['PASS_THROUGH', 'ENTER_BLOCKER_SPACE'])
  })
}

const optionalCombatPassageSelectionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    movementPassageSelectionDtoSchema('OVERRUN'),
    movementPassageSelectionDtoSchema('TUMBLE'),
    movementPassageSelectionDtoSchema('CLIMB_ONTO_LARGER_CREATURE'),
    z.strictObject({
      kind: z.literal('DISARM'),
      heldItemId: uuidSchema,
      defenderCheckDefinitionId: uuidSchema,
      heldItemStateChecksum: checksumSchema
    }),
    z.strictObject({
      kind: z.literal('SHOVE_ASIDE'),
      defenderCheckDefinitionId: uuidSchema,
      destination: z.strictObject({ x: z.number(), y: z.number() }),
      displacement: z.strictObject({
        amount: z.literal(5),
        unit: z.literal('FEET'),
        sceneUnits: z.number().check(z.positive())
      }),
      sceneId: uuidSchema,
      sceneVersion: nonNegativeIntegerSchema,
      targetTokenId: uuidSchema,
      stateChecksum: checksumSchema
    })
  ])
)

/** What started an Encounter contest check, with the facts only that origin seals (D152). */
const contestCheckOriginDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('OPTIONAL_COMBAT'),
      actionKind: z.enum([
        'DISARM',
        'SHOVE_ASIDE',
        'OVERRUN',
        'TUMBLE',
        'CLIMB_ONTO_LARGER_CREATURE'
      ]),
      pin: z.strictObject({
        snapshotChecksum: checksumSchema,
        definitionId: uuidSchema,
        definitionVersion: positiveIntegerSchema,
        definitionChecksum: checksumSchema,
        moduleKey: capabilityKeySchema,
        moduleContractVersion: contractVersionSchema
      }),
      optionId: checksumSchema,
      selectionContractChecksum: checksumSchema,
      resolvedSelectionChecksum: checksumSchema,
      selection: optionalCombatPassageSelectionDtoSchema,
      movementContinuation: z.optional(z.nullable(optionalCombatPassageContinuationDtoSchema))
    }),
    z.strictObject({
      kind: z.literal('BASIC_ACTION'),
      initiatorCheckDefinitionId: uuidSchema,
      /** The action's name, which the defender's check prompt and the timeline read. */
      actionLabel: identifierSchema
    }),
    z.strictObject({
      /** A held creature's escape its holder contests; `actionId` is the escape module (D152). */
      kind: z.literal('ESCAPE'),
      activeEffectId: uuidSchema,
      initiatorCheckDefinitionId: uuidSchema,
      actionLabel: identifierSchema
    })
  ])
)

/**
 * The one two-roller contest pending context (D152): the initiator and the defender each roll their
 * own check, and the defender picks its check when it responds.
 */
export const serverContestCheckPendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_CONTEST_CHECK'),
      schemaVersion: z.literal(1),
      origin: contestCheckOriginDtoSchema,
      actionId: identifierSchema,
      sourceActorId: uuidSchema,
      targetActorId: uuidSchema,
      /** Sealed controller identity for the initiator evidence request. */
      initiatorControllerCharacterId: z.nullable(uuidSchema),
      sceneContext: z.nullable(
        z.strictObject({
          sceneId: uuidSchema,
          sceneVersion: nonNegativeIntegerSchema,
          sourceTokenId: uuidSchema,
          targetTokenId: uuidSchema
        })
      ),
      positionalDependencyChecksum: z.nullable(checksumSchema),
      contestGraph: z.strictObject({
        definitionId: uuidSchema,
        checksum: checksumSchema,
        identityChecksum: checksumSchema
      }),
      source: z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('CHARACTER_ACTION'),
          characterId: uuidSchema,
          streamVersion: nonNegativeIntegerSchema,
          projectionChecksum: checksumSchema,
          mechanicalContextChecksum: checksumSchema,
          publishedDefinitionId: uuidSchema,
          publishedDefinitionChecksum: checksumSchema
        }),
        z.strictObject({
          kind: z.literal('ENCOUNTER_FEATURE'),
          creatureSourceId: uuidSchema,
          sourceRevision: positiveIntegerSchema,
          sourceVersionId: uuidSchema,
          sourceChecksum: checksumSchema,
          ownerFeatureId: uuidSchema,
          featureOptionId: z.nullable(uuidSchema),
          effectId: uuidSchema,
          authoredEffectChecksum: checksumSchema,
          compiledEffectChecksum: checksumSchema,
          publishedDefinitionId: uuidSchema,
          publishedDefinitionChecksum: checksumSchema
        }),
        z.strictObject({
          kind: z.literal('OPTIONAL_COMBAT_DEFINITION'),
          definitionId: uuidSchema,
          definitionVersion: positiveIntegerSchema,
          definitionChecksum: checksumSchema,
          moduleKey: capabilityKeySchema,
          moduleContractVersion: contractVersionSchema
        }),
        z.strictObject({
          kind: z.literal('BASIC_ACTION'),
          definitionId: uuidSchema,
          definitionVersion: positiveIntegerSchema,
          definitionChecksum: checksumSchema,
          effectId: uuidSchema,
          authoredEffectChecksum: checksumSchema,
          compiledEffectChecksum: checksumSchema
        }),
        z.strictObject({
          kind: z.literal('HELD_EFFECT'),
          activeEffectId: uuidSchema,
          definitionChecksum: checksumSchema
        })
      ]),
      target: z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('CHARACTER'),
          characterId: uuidSchema,
          streamVersion: nonNegativeIntegerSchema,
          projectionChecksum: checksumSchema,
          mechanicalContextChecksum: checksumSchema,
          stateChecksum: checksumSchema
        }),
        z.strictObject({ kind: z.literal('ENCOUNTER_ACTOR'), currentnessChecksum: checksumSchema })
      ]),
      initiator: contestInitiatorD20PolicyDtoSchema,
      defender: contestDefenderDtoSchema,
      rollEvidence: z._default(
        z.strictObject({
          initiator: z._default(z.nullable(contestRollEvidenceDtoSchema), null),
          defender: z._default(z.nullable(contestDefenderRollEvidenceDtoSchema), null)
        }),
        { initiator: null, defender: null }
      ),
      actionEconomy: optionalCombatContestActionEconomyReceiptDtoSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (value.sourceActorId === value.targetActorId) {
          context.addIssue({
            code: 'custom',
            path: ['targetActorId'],
            message: 'Contest participants must be distinct.'
          })
        }
        if (
          value.initiator.actorId !== value.sourceActorId ||
          value.defender.actorId !== value.targetActorId
        ) {
          context.addIssue({
            code: 'custom',
            path: ['initiator', 'actorId'],
            message: 'Contest policy participants must match the selected actors.'
          })
        }
        const { origin } = value
        const defenderChecks = value.defender.checks.map((check) => check.checkDefinitionId)
        if (new Set(defenderChecks).size !== defenderChecks.length) {
          context.addIssue({
            code: 'custom',
            path: ['defender', 'checks'],
            message: 'Contest defender checks must be unique.'
          })
        }
        if (
          (origin.kind === 'BASIC_ACTION') !== (value.source.kind === 'BASIC_ACTION') ||
          (origin.kind === 'ESCAPE') !== (value.source.kind === 'HELD_EFFECT') ||
          (origin.kind === 'ESCAPE' &&
            value.source.kind === 'HELD_EFFECT' &&
            value.source.activeEffectId !== origin.activeEffectId)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['source', 'kind'],
            message: 'A basic-action contest seals its action and an escape its held effect.'
          })
        }
        if (origin.kind === 'OPTIONAL_COMBAT') {
          if (
            defenderChecks.length !== 1 ||
            defenderChecks[0] !== origin.selection.defenderCheckDefinitionId
          ) {
            context.addIssue({
              code: 'custom',
              path: ['origin', 'selection'],
              message: 'Optional-combat contest selection does not match its sealed defender check.'
            })
          }
          if (origin.actionKind !== origin.selection.kind) {
            context.addIssue({
              code: 'custom',
              path: ['origin', 'selection'],
              message: 'Optional-combat contest action and selection kinds must match.'
            })
          }
          const passageAction = 'successMovement' in origin.selection
          if (
            passageAction !==
            (origin.movementContinuation !== null && origin.movementContinuation !== undefined)
          ) {
            context.addIssue({
              code: 'custom',
              path: ['origin', 'movementContinuation'],
              message: 'Only passage contests retain a frozen movement continuation.'
            })
          }
        }
        const defenderEvidence = value.rollEvidence.defender
        const defenderCheck =
          defenderEvidence === null
            ? null
            : value.defender.checks.find(
                (check) => check.checkDefinitionId === defenderEvidence.checkDefinitionId
              )
        if (defenderCheck === undefined) {
          context.addIssue({
            code: 'custom',
            path: ['rollEvidence', 'defender', 'checkDefinitionId'],
            message: 'Contest defender evidence must roll a sealed defender check.'
          })
        }
        const requireRollEvidence = (
          evidence: z.infer<typeof contestRollEvidenceDtoSchema> | null,
          policy: z.infer<typeof contestD20RollDtoSchema> | null | undefined,
          path: 'initiator' | 'defender'
        ) => {
          if (evidence === null || !policy) return
          if (evidence.rawFaces.length !== rollModeKeepFaceCount(policy.keep)) {
            context.addIssue({
              code: 'custom',
              path: ['rollEvidence', path, 'rawFaces'],
              message: 'Contest evidence does not match its sealed roll mode.'
            })
          }
          if (evidence.requestId.length === 0) {
            context.addIssue({
              code: 'custom',
              path: ['rollEvidence', path, 'requestId'],
              message: 'Contest evidence request is invalid.'
            })
          }
        }
        requireRollEvidence(value.rollEvidence.initiator, value.initiator, 'initiator')
        requireRollEvidence(defenderEvidence, defenderCheck, 'defender')
        if (value.rollEvidence.defender !== null && value.rollEvidence.initiator === null) {
          context.addIssue({
            code: 'custom',
            path: ['rollEvidence', 'defender'],
            message: 'Contest defender evidence requires initiator evidence.'
          })
        }
      })
    )
)
