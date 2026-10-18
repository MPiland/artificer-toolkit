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
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'

/**
 * Immutable pending evidence context for an optional-combat contested action.
 * It retains identities and currentness pins only; the executable contest graph
 * is re-created from its sealed System policy pin when the request resumes.
 */
const optionalCombatContestD20PolicyDtoSchema = lazySchema(() =>
  z
    .strictObject({
      actorId: uuidSchema,
      requestNodeId: localNodeIdSchema,
      rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
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

const optionalCombatContestRollEvidenceDtoSchema = lazySchema(() =>
  z.nullable(
    z.strictObject({
      requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
      rawFaces: z.array(pendingD20FaceSchema).check(z.minLength(1)).check(z.maxLength(2))
    })
  )
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

const optionalCombatPassageSelectionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('OVERRUN'),
      economy: z.enum(['ACTION', 'BONUS_ACTION']),
      defenderCheckDefinitionId: uuidSchema
    }),
    z.strictObject({
      kind: z.literal('TUMBLE'),
      economy: z.enum(['ACTION', 'BONUS_ACTION']),
      defenderCheckDefinitionId: uuidSchema
    }),
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
      actionKind: z.enum(['DISARM', 'SHOVE_ASIDE', 'OVERRUN', 'TUMBLE']),
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
      initiator: optionalCombatContestD20PolicyDtoSchema,
      defender: z.extend(optionalCombatContestD20PolicyDtoSchema, {
        checkDefinitionId: uuidSchema
      }),
      rollEvidence: z._default(
        z.strictObject({
          initiator: z._default(optionalCombatContestRollEvidenceDtoSchema, null),
          defender: z._default(optionalCombatContestRollEvidenceDtoSchema, null)
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
        if (value.defender.checkDefinitionId !== origin.selection.defenderCheckDefinitionId) {
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
        const passageAction = origin.actionKind === 'OVERRUN' || origin.actionKind === 'TUMBLE'
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
        const requireRollEvidence = (
          evidence: z.infer<typeof optionalCombatContestRollEvidenceDtoSchema>,
          policy: z.infer<typeof optionalCombatContestD20PolicyDtoSchema>,
          path: 'initiator' | 'defender'
        ) => {
          if (evidence === null) return
          const expectedFaces = policy.rollMode === 'NORMAL' ? 1 : 2
          if (evidence.rawFaces.length !== expectedFaces) {
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
        requireRollEvidence(value.rollEvidence.defender, value.defender, 'defender')
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
