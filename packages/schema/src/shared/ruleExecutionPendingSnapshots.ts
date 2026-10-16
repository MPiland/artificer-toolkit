import { z, lazySchema } from '../zod.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import { rangeDtoSchema, type RangeDto } from './range.js'
import { spatialPointDtoSchema } from './spatialFacts.js'
import { encounterInitiativePendingContextDtoSchema } from './ruleExecutionInitiativePending.js'
import {
  optionalCombatPassageContinuationDtoSchema,
  serverOptionalCombatContestPendingContextDtoSchema
} from './ruleExecutionOptionalCombatPending.js'
import {
  encounterLegendaryResistancePinDtoSchema,
  validateEncounterLegendaryResistancePin
} from './ruleExecutionDirectActionPendingContexts.js'
import { serverRuleExecutionD20PolicyDtoSchema } from './ruleExecutionEvidence.js'
import {
  encounterFailedCounterDtoSchema,
  type EncounterFailedCounterDto
} from './ruleExecutionReactionChoice.js'
import {
  movementReactionPendingContextDtoSchema,
  spatialPendingContextDtoSchema
} from './ruleExecutionSpatialPendingContexts.js'
import {
  serverRuleExecutionPendingApplicationContextDtoSchema,
  type ServerRuleExecutionPendingApplicationContextDto
} from './ruleExecutionPendingApplication.js'
import {
  ruleExecutionPhaseReceiptsDtoSchema,
  serverCompletedRuleExecutionDtoSchema,
  serverRuleExecutionContinuationDtoSchema,
  serverInitiativeDeclarationRequestDtoSchema,
  type RuleExecutionPhaseReceiptsDto,
  type ServerRuleExecutionContinuationDto
} from './ruleExecutionProtocol.js'
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
import { legendaryActionChoicePendingContextDtoSchema } from './ruleExecutionTurnPending.js'

export type ServerKernelRuleExecutionPendingSnapshotDto = ServerRuleExecutionContinuationDto & {
  snapshotKind: 'KERNEL_EVIDENCE'
  optionalCombatSnapshotChecksum?: string | null
  applicationContext: ServerRuleExecutionPendingApplicationContextDto
  phaseReceipts?: RuleExecutionPhaseReceiptsDto
  /** One sealed Cleaving choice resumes after the concentration damage children finish. */
  deferredCleaving?: OptionalCombatCleavingChoicePendingContextDto
}

/**
 * Aggregate-owned intent choice for Speed Factor initiative.  It retains the
 * same frozen Encounter root/staged participant snapshot as subsequent score
 * evaluation, but intentionally carries no executable graph or dice evidence.
 */
const initiativeDeclarationAggregateChoicePendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_INITIATIVE_DECLARATION'),
      schemaVersion: z.literal(1),
      root: encounterInitiativePendingContextDtoSchema.shape.root,
      request: serverInitiativeDeclarationRequestDtoSchema
    })
    .check(
      z.superRefine((value, context) => {
        const participant = value.root.stagedInitiativeRoundState.participants.find(
          (candidate) => candidate.actorId === value.request.actorId
        )
        if (
          value.request.encounterId !== value.root.stagedInitiativeRoundState.round.encounterId ||
          value.request.round !== value.root.round ||
          !participant ||
          participant.version !== value.request.participantExpectedVersion
        ) {
          context.addIssue({
            code: 'custom',
            path: ['request'],
            message:
              'Initiative declaration request must bind its exact staged Encounter participant.'
          })
        }
      })
    )
)

/**
 * A completed action may expose one bounded, human-confirmed Cleaving step.
 * It retains facts only: the original action receipt is terminal and neither
 * executable graphs nor damage formulas cross this aggregate-choice boundary.
 */
type OptionalCombatCleavingChoicePendingContextDto = {
  kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING'
  schemaVersion: 1
  parentOccurrenceId: string
  parentResultChecksum: string
  sourceActorId: string
  sourceControllerCharacterId: string | null
  action: {
    actionId: string
    publishedDefinitionId: string
    publishedDefinitionChecksum: string
    attackKind: 'MELEE' | 'RANGED' | 'OTHER'
    range: RangeDto
  }
  sourceCurrentness:
    | {
        kind: 'CHARACTER'
        actorId: string
        characterId: string
        streamVersion: number
        projectionChecksum: string
        mechanicalContextChecksum: string
      }
    | {
        kind: 'ENCOUNTER_ACTOR'
        actorId: string
        sourceRevision: number
        sourceVersionId: string
        sourceChecksum: string
        stateChecksum: string
      }
  initialTargetActorId: string
  chainStep: number
  optionalCombat: {
    definitionId: string
    definitionVersion: number
    definitionChecksum: string
  }
  scene: {
    sceneId: string
    sceneVersion: number
    effectiveGridChecksum: string
    sourceTokenId: string
  }
  originalAttack: { total: number; naturalRoll: number }
  damage: {
    sourceNodeId: string
    sourceOperationKey: string
    damageTypeId: string
    resolvedAmount: number
    appliedAmount: number
    remainingAmount: number
    envelopeChecksum: string
  }
  visitedTargetActorIds: string[]
  options: {
    optionId: string
    targetActorId: string
    targetTokenId: string
    targetActorVersion: number
    /** Exact mutable target state sealed when this option was offered. */
    targetStateChecksum: string
    armorClass: number
    footprintChecksum: string
  }[]
}

const optionalCombatCleavingChoicePendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_OPTIONAL_COMBAT_CLEAVING'),
      schemaVersion: z.literal(1),
      parentOccurrenceId: uuidSchema,
      parentResultChecksum: checksumSchema,
      sourceActorId: uuidSchema,
      sourceControllerCharacterId: z.nullable(uuidSchema),
      /** Exact authored action facts revalidated before a Cleaving choice applies. */
      action: z.strictObject({
        actionId: identifierSchema,
        publishedDefinitionId: uuidSchema,
        publishedDefinitionChecksum: checksumSchema,
        attackKind: z.enum(['MELEE', 'RANGED', 'OTHER']),
        range: z.custom<RangeDto>((value) => rangeDtoSchema.safeParse(value).success)
      }),
      /**
       * Source facts are deliberately separate from the offered target options:
       * an old choice can never authorize a changed Character or Creature action.
       */
      sourceCurrentness: z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('CHARACTER'),
          actorId: uuidSchema,
          characterId: uuidSchema,
          streamVersion: nonNegativeIntegerSchema,
          projectionChecksum: checksumSchema,
          mechanicalContextChecksum: checksumSchema
        }),
        z.strictObject({
          kind: z.literal('ENCOUNTER_ACTOR'),
          actorId: uuidSchema,
          sourceRevision: positiveIntegerSchema,
          sourceVersionId: uuidSchema,
          sourceChecksum: checksumSchema,
          stateChecksum: checksumSchema
        })
      ]),
      initialTargetActorId: uuidSchema,
      chainStep: z
        .number()
        .check(z.int())
        .check(z.gte(1))
        .check(z.lte(MAX_ENCOUNTER_ACTORS - 1)),
      optionalCombat: z.strictObject({
        definitionId: uuidSchema,
        definitionVersion: positiveIntegerSchema,
        definitionChecksum: checksumSchema
      }),
      scene: z.strictObject({
        sceneId: uuidSchema,
        sceneVersion: nonNegativeIntegerSchema,
        effectiveGridChecksum: checksumSchema,
        sourceTokenId: uuidSchema
      }),
      originalAttack: z.strictObject({
        total: integerSchema,
        naturalRoll: integerSchema.check(z.gte(1)).check(z.lte(20))
      }),
      damage: z
        .strictObject({
          sourceNodeId: localNodeIdSchema,
          sourceOperationKey: capabilityKeySchema,
          damageTypeId: uuidSchema,
          resolvedAmount: positiveIntegerSchema,
          appliedAmount: nonNegativeIntegerSchema,
          remainingAmount: positiveIntegerSchema,
          envelopeChecksum: checksumSchema
        })
        .check(
          z.superRefine((damage, context) => {
            if (damage.resolvedAmount - damage.appliedAmount !== damage.remainingAmount) {
              context.addIssue({
                code: 'custom',
                path: ['remainingAmount'],
                message: 'Cleaving must retain the exact finalized excess damage.'
              })
            }
          })
        ),
      visitedTargetActorIds: z
        .array(uuidSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS - 1)),
      options: z
        .array(
          z.strictObject({
            optionId: checksumSchema,
            targetActorId: uuidSchema,
            targetTokenId: uuidSchema,
            targetActorVersion: nonNegativeIntegerSchema,
            targetStateChecksum: checksumSchema,
            armorClass: nonNegativeIntegerSchema,
            footprintChecksum: checksumSchema
          })
        )
        .check(z.minLength(1))
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS - 1))
    })
    .check(
      z.superRefine((value, context) => {
        if (
          value.sourceCurrentness.actorId !== value.sourceActorId ||
          value.action.attackKind !== 'MELEE'
        ) {
          context.addIssue({
            code: 'custom',
            path: ['sourceCurrentness'],
            message: 'Cleaving must retain the exact melee action source currentness.'
          })
        }
        const visited = new Set<string>()
        for (const [index, actorId] of value.visitedTargetActorIds.entries()) {
          if (visited.has(actorId)) {
            context.addIssue({
              code: 'custom',
              path: ['visitedTargetActorIds', index],
              message: 'Cleaving visited targets must be unique.'
            })
          }
          visited.add(actorId)
        }
        if (value.visitedTargetActorIds[0] !== value.initialTargetActorId) {
          context.addIssue({
            code: 'custom',
            path: ['visitedTargetActorIds', 0],
            message: 'Cleaving must retain its original defeated target as the chain root.'
          })
        }
        const options = new Set<string>()
        for (const [index, option] of value.options.entries()) {
          if (
            options.has(option.optionId) ||
            visited.has(option.targetActorId) ||
            option.targetActorId === value.sourceActorId
          ) {
            context.addIssue({
              code: 'custom',
              path: ['options', index],
              message: 'Cleaving options must be unique, unvisited, and non-self targets.'
            })
          }
          options.add(option.optionId)
        }
      })
    )
)

const serverKernelRuleExecutionPendingSnapshotObjectSchema = lazySchema(() =>
  z
    .extend(serverRuleExecutionContinuationDtoSchema, {
      snapshotKind: z.literal('KERNEL_EVIDENCE'),
      optionalCombatSnapshotChecksum: z.optional(z.nullable(checksumSchema)),
      applicationContext: serverRuleExecutionPendingApplicationContextDtoSchema,
      deferredCleaving: z.optional(optionalCombatCleavingChoicePendingContextDtoSchema),
      /**
       * Completed TEST evidence retained only while the bounded OUTCOME phase is
       * pending. This is receipt material, never an executable graph.
       */
      phaseReceipts: z.optional(z.lazy(() => ruleExecutionPhaseReceiptsDtoSchema))
    })
    .check(
      z.superRefine((snapshot, context) => {
        const concentration =
          snapshot.applicationContext.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
          snapshot.applicationContext.phase.kind === 'CONCENTRATION_EVIDENCE'
            ? snapshot.applicationContext.phase.concentration
            : null
        if (
          concentration &&
          (snapshot.occurrenceId === concentration.parentOccurrenceId ||
            snapshot.graph.source.definitionId !== concentration.concentrationDefinition.id ||
            snapshot.graph.source.checksum !== concentration.concentrationDefinition.checksum ||
            snapshot.request.kind !== 'INTEGER_RANGE' ||
            snapshot.request.min !== 1 ||
            snapshot.request.max !== 20)
        )
          context.addIssue({
            code: 'custom',
            path: ['applicationContext', 'phase'],
            message:
              'Concentration movement evidence must retain its child continuation identity, exact graph, and d20 request.'
          })
        if (
          snapshot.deferredCleaving &&
          (snapshot.applicationContext.kind !== 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' ||
            snapshot.deferredCleaving.parentOccurrenceId !==
              snapshot.applicationContext.parentOccurrenceId ||
            snapshot.optionalCombatSnapshotChecksum == null)
        )
          context.addIssue({
            code: 'custom',
            path: ['deferredCleaving'],
            message:
              'Deferred Cleaving requires its concentration parent and pinned optional-combat policy.'
          })
        if (
          snapshot.phaseReceipts &&
          (snapshot.phaseReceipts.length !== 1 || snapshot.phaseReceipts[0]?.phase !== 'TEST')
        ) {
          context.addIssue({
            code: 'custom',
            path: ['phaseReceipts'],
            message: 'A pending phased occurrence may retain only its completed TEST receipt.'
          })
        }
        const twoPhase =
          (snapshot.applicationContext.kind === 'ENCOUNTER_ACTION' ||
            snapshot.applicationContext.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION' ||
            snapshot.applicationContext.kind === 'ENCOUNTER_ACTOR_RULE_ACTION' ||
            snapshot.applicationContext.kind === 'ENCOUNTER_CREATURE_RULE_ACTION') &&
          snapshot.applicationContext.twoPhase?.phase === 'OUTCOME'
            ? snapshot.applicationContext.twoPhase
            : snapshot.applicationContext.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
                snapshot.applicationContext.phase.kind === 'ACTION_EVIDENCE' &&
                snapshot.applicationContext.phase.twoPhase?.phase === 'OUTCOME'
              ? snapshot.applicationContext.phase.twoPhase
              : null
        if (!twoPhase) return
        const receipt = snapshot.phaseReceipts?.[0]
        if (
          !receipt ||
          receipt.phase !== 'TEST' ||
          checksumRuleDocument(receipt.execution) !== twoPhase.testExecutionChecksum ||
          checksumRuleDocument(twoPhase.testExecution) !== twoPhase.testExecutionChecksum ||
          receipt.template.checksum !== twoPhase.testTemplateChecksum ||
          receipt.specializedChecksum !== receipt.execution.evidence.source.checksum ||
          checksumRuleDocument(receipt.execution) !== checksumRuleDocument(twoPhase.testExecution)
        )
          context.addIssue({
            code: 'custom',
            path: ['phaseReceipts'],
            message: 'Pending OUTCOME must retain its exact sealed TEST receipt.'
          })
      })
    )
)

const optionalCombatPassageChoiceOptionDtoSchema = lazySchema(() =>
  z.strictObject({
    optionId: checksumSchema,
    ruleKind: z.enum(['OVERRUN', 'TUMBLE']),
    economy: z.enum(['ACTION', 'BONUS_ACTION']),
    definitionId: uuidSchema,
    definitionVersion: positiveIntegerSchema,
    definitionChecksum: checksumSchema,
    moduleKey: capabilityKeySchema,
    moduleContractVersion: contractVersionSchema
  })
)

const optionalCombatPassageChoicePendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'),
      schemaVersion: z.literal(1),
      movement: optionalCombatPassageContinuationDtoSchema,
      sourceActorId: uuidSchema,
      sourceTokenId: uuidSchema,
      sourceControllerCharacterId: z.nullable(uuidSchema),
      options: z
        .array(optionalCombatPassageChoiceOptionDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(4)),
      optionsChecksum: checksumSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (value.movement.root.tokenId !== value.sourceTokenId) {
          context.addIssue({
            code: 'custom',
            path: ['sourceTokenId'],
            message: 'Passage choice source token must own the sealed movement root.'
          })
        }
        const ids = new Set<string>()
        for (const [index, option] of value.options.entries()) {
          if (ids.has(option.optionId)) {
            context.addIssue({
              code: 'custom',
              path: ['options', index, 'optionId'],
              message: 'Passage choice options must have unique deterministic identities.'
            })
          }
          ids.add(option.optionId)
        }
        if (checksumRuleDocument(value.options) !== value.optionsChecksum) {
          context.addIssue({
            code: 'custom',
            path: ['optionsChecksum'],
            message: 'Passage choice options checksum must bind the complete issued option set.'
          })
        }
      })
    )
)

export type OptionalCombatPassageChoicePendingContextDto = z.infer<
  typeof optionalCombatPassageChoicePendingContextDtoSchema
>

/**
 * A point-area action waits on one save per caught creature at once. Each target keeps its own sealed
 * kernel continuation (a derived occurrence id keeps their request ids apart); the aggregate keeps the
 * caught set, sealed with a checksum of the Scene facts that decided it.
 */
/**
 * A caught creature's Legendary Resistance on its failed save: the offer sealed against that save and
 * the creature's pool when it was made, then the controller's decision once taken. The charge is spent
 * when the area commits, never here.
 */
const encounterAreaLegendaryResistanceDtoSchema = lazySchema(() =>
  z.strictObject({
    originalExecutionChecksum: checksumSchema,
    targetStateChecksum: checksumSchema,
    d20: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema),
    resistance: encounterLegendaryResistancePinDtoSchema,
    decision: z.optional(
      z.strictObject({
        selection: z.enum(['DECLINE', 'USE']),
        choiceExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema)
      })
    )
  })
)
export type EncounterAreaLegendaryResistanceDto = z.infer<
  typeof encounterAreaLegendaryResistanceDtoSchema
>

export type EncounterAreaActionPendingContextDto = {
  kind: 'ENCOUNTER_AREA_ACTION'
  schemaVersion: 1
  commandJson: string
  commandFingerprint: string
  initiatorUserId: string
  casterActorId: string
  /** Whether the action leaves a zone at the origin; such an area catches no creature by itself. */
  placesZone: boolean
  /** The Scene the action was read against; null for a list of chosen creatures that read none. */
  scene: { sceneId: string; sceneVersion: number } | null
  /**
   * The origin and the compiled shape (a directed shape holds its direction), in Scene units; null
   * for a list of chosen creatures that names no area, whose creatures are the ones it chose.
   */
  area: { origin: { x: number; y: number }; shape: EncounterAreaShapeDto } | null
  /** Binds the Scene version, the area, and every creature still caught with its token footprint. */
  caughtChecksum: string
  /** Creatures the GM took out of the area while the saves were pending. */
  removedActorIds: string[]
  /** The counters reactors attempted and failed against this cast, which the area's commit spends (D127). */
  failedCounters?: EncounterFailedCounterDto[]
  targets: {
    actorId: string
    /** The footprint of the creature's token when the area caught it; null when it has none on the Scene read. */
    token: EncounterAreaTokenDto | null
    /** Sealed against this creature's own source and target facts, so its save resumes only if they hold. */
    snapshot: ServerKernelRuleExecutionPendingSnapshotDto
    /** Whether the caster perceived the creature when the area opened; sealed, so it cannot drift. */
    perceivedByCaster: boolean
    /** Set once the creature's own roller answered its save; the GM can no longer take it out. */
    testedJson?: string
    /** Set when the answered save failed and the creature has a Legendary Resistance to offer. */
    legendaryResistance?: EncounterAreaLegendaryResistanceDto
  }[]
}

const encounterAreaShapeDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('RADIUS'), radius: z.number().check(z.positive()) }),
    z.strictObject({ kind: z.literal('CUBE'), edgeLength: z.number().check(z.positive()) }),
    z.strictObject({
      kind: z.literal('CONE'),
      length: z.number().check(z.positive()),
      toward: spatialPointDtoSchema
    }),
    z.strictObject({
      kind: z.literal('LINE'),
      length: z.number().check(z.positive()),
      width: z.number().check(z.positive()),
      toward: spatialPointDtoSchema
    }),
    z.strictObject({
      kind: z.literal('CUBE_FROM_SIDE'),
      edgeLength: z.number().check(z.positive()),
      cellSize: z.number().check(z.positive()),
      toward: spatialPointDtoSchema
    })
  ])
)
export type EncounterAreaShapeDto = z.infer<typeof encounterAreaShapeDtoSchema>

const encounterAreaTokenDtoSchema = lazySchema(() =>
  z.strictObject({
    tokenId: uuidSchema,
    position: spatialPointDtoSchema,
    width: z.number().check(z.positive()),
    height: z.number().check(z.positive()),
    rotationDegrees: z.number().check(z.gte(0)).check(z.lt(360))
  })
)
export type EncounterAreaTokenDto = z.infer<typeof encounterAreaTokenDtoSchema>

const encounterAreaActionPendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_AREA_ACTION'),
      schemaVersion: z.literal(1),
      commandJson: z.string(),
      commandFingerprint: checksumSchema,
      initiatorUserId: uuidSchema,
      casterActorId: uuidSchema,
      placesZone: z.boolean(),
      scene: z.nullable(
        z.strictObject({ sceneId: uuidSchema, sceneVersion: nonNegativeIntegerSchema })
      ),
      area: z.nullable(
        z.strictObject({ origin: spatialPointDtoSchema, shape: encounterAreaShapeDtoSchema })
      ),
      caughtChecksum: checksumSchema,
      removedActorIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      failedCounters: z.optional(
        z.array(encounterFailedCounterDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      ),
      targets: z
        .array(
          z.strictObject({
            actorId: uuidSchema,
            token: z.nullable(encounterAreaTokenDtoSchema),
            perceivedByCaster: z.boolean(),
            snapshot: z.lazy(() => serverKernelRuleExecutionPendingSnapshotDtoSchema),
            testedJson: z.optional(z.string()),
            legendaryResistance: z.optional(encounterAreaLegendaryResistanceDtoSchema)
          })
        )
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    })
    .check(
      z.superRefine((value, context) => {
        if ((value.area !== null || value.placesZone) && value.scene === null)
          context.addIssue({
            code: 'custom',
            path: ['scene'],
            message: 'An area and a placed zone are read against a Scene.'
          })
        if (value.placesZone && value.area === null)
          context.addIssue({
            code: 'custom',
            path: ['area'],
            message: 'A placed zone fills an area.'
          })
        const seen = new Set<string>()
        const seenOccurrences = new Set<string>()
        for (const [index, target] of value.targets.entries()) {
          const inner = target.snapshot.applicationContext
          if (target.token !== null && value.scene === null)
            context.addIssue({
              code: 'custom',
              path: ['targets', index, 'token'],
              message: 'A token footprint is sealed only against a Scene that was read.'
            })
          // A creature's own save is rolled by the creature, once. An attack ray is rolled by the
          // caster, and a creature several rays are aimed at has an entry for each.
          const casterRolls =
            inner.kind === 'ENCOUNTER_ACTION' && inner.rollerActorId === value.casterActorId
          if (
            inner.kind !== 'ENCOUNTER_ACTION' ||
            seenOccurrences.has(target.snapshot.occurrenceId) ||
            (seen.has(target.actorId) && !casterRolls) ||
            value.removedActorIds.includes(target.actorId) ||
            inner.commandFingerprint !== value.commandFingerprint ||
            inner.initiatorUserId !== value.initiatorUserId ||
            (inner.rollerActorId !== target.actorId && !casterRolls)
          )
            context.addIssue({
              code: 'custom',
              path: ['targets', index],
              message:
                'Each area roll must be a distinct, kept creature whose sealed continuation shares the area root and is rolled by the creature or the caster.'
            })
          seen.add(target.actorId)
          seenOccurrences.add(target.snapshot.occurrenceId)
          if (target.legendaryResistance) {
            if (
              target.testedJson === undefined ||
              target.legendaryResistance.resistance.targetActorId !== target.actorId ||
              target.legendaryResistance.resistance.poolRemaining !==
                target.legendaryResistance.resistance.poolBefore -
                  target.legendaryResistance.resistance.featureCost
            )
              context.addIssue({
                code: 'custom',
                path: ['targets', index, 'legendaryResistance'],
                message:
                  'A Legendary Resistance offer belongs to the creature’s own answered save and an available Feature cost.'
              })
            validateEncounterLegendaryResistancePin(
              target.legendaryResistance.resistance,
              context,
              ['targets', index, 'legendaryResistance', 'resistance']
            )
          }
        }
      })
    )
)

export type ServerAggregateChoicePendingSnapshotDto = {
  snapshotKind: 'AGGREGATE_CHOICE'
  schemaVersion: 1
  occurrenceId: string
  optionalCombatSnapshotChecksum?: string | null
  applicationContext:
    | z.infer<typeof legendaryActionChoicePendingContextDtoSchema>
    | z.infer<typeof initiativeDeclarationAggregateChoicePendingContextDtoSchema>
    | OptionalCombatCleavingChoicePendingContextDto
    | OptionalCombatPassageChoicePendingContextDto
    | EncounterAreaActionPendingContextDto
}

const serverAggregateChoicePendingSnapshotObjectSchema = lazySchema(() =>
  z.strictObject({
    snapshotKind: z.literal('AGGREGATE_CHOICE'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    optionalCombatSnapshotChecksum: z.optional(z.nullable(checksumSchema)),
    applicationContext: z.discriminatedUnion('kind', [
      legendaryActionChoicePendingContextDtoSchema,
      initiativeDeclarationAggregateChoicePendingContextDtoSchema,
      optionalCombatCleavingChoicePendingContextDtoSchema,
      optionalCombatPassageChoicePendingContextDtoSchema,
      encounterAreaActionPendingContextDtoSchema
    ])
  })
)
export type ServerRuleExecutionPendingSnapshotDto =
  | ServerKernelRuleExecutionPendingSnapshotDto
  | ServerAggregateChoicePendingSnapshotDto

export const serverKernelRuleExecutionPendingSnapshotDtoSchema: z.ZodMiniType<ServerKernelRuleExecutionPendingSnapshotDto> =
  serverKernelRuleExecutionPendingSnapshotObjectSchema

export const serverAggregateChoicePendingSnapshotDtoSchema: z.ZodMiniType<ServerAggregateChoicePendingSnapshotDto> =
  serverAggregateChoicePendingSnapshotObjectSchema

/** Reuses snapshot integrity checks while excluding unrelated Scene transport branches. */
export const serverMovementRuleExecutionPendingSnapshotDtoSchema: z.ZodMiniType<ServerRuleExecutionPendingSnapshotDto> =
  lazySchema(() =>
    z.discriminatedUnion('snapshotKind', [
      z.safeExtend(serverKernelRuleExecutionPendingSnapshotObjectSchema, {
        applicationContext: z.discriminatedUnion('kind', [
          spatialPendingContextDtoSchema,
          movementReactionPendingContextDtoSchema,
          serverOptionalCombatContestPendingContextDtoSchema
        ])
      }),
      z.safeExtend(serverAggregateChoicePendingSnapshotObjectSchema, {
        applicationContext: optionalCombatPassageChoicePendingContextDtoSchema
      })
    ])
  )

/** Persisted occurrence snapshots are either sealed kernel evidence or an aggregate tactical choice. */
export const serverRuleExecutionPendingSnapshotDtoSchema: z.ZodMiniType<ServerRuleExecutionPendingSnapshotDto> =
  lazySchema(() =>
    z.discriminatedUnion('snapshotKind', [
      serverKernelRuleExecutionPendingSnapshotObjectSchema,
      serverAggregateChoicePendingSnapshotObjectSchema
    ])
  )

export function isServerKernelRuleExecutionPendingSnapshot(
  snapshot: ServerRuleExecutionPendingSnapshotDto
): snapshot is ServerKernelRuleExecutionPendingSnapshotDto {
  return snapshot.snapshotKind === 'KERNEL_EVIDENCE'
}

export function requireServerKernelRuleExecutionPendingSnapshot(
  snapshot: ServerRuleExecutionPendingSnapshotDto
): ServerKernelRuleExecutionPendingSnapshotDto {
  if (!isServerKernelRuleExecutionPendingSnapshot(snapshot)) {
    throw new Error('The pending occurrence does not retain kernel evidence.')
  }
  return snapshot
}

export function isServerAggregateChoicePendingSnapshot(
  snapshot: ServerRuleExecutionPendingSnapshotDto
): snapshot is ServerAggregateChoicePendingSnapshotDto {
  return snapshot.snapshotKind === 'AGGREGATE_CHOICE'
}

export function requireServerAggregateChoicePendingSnapshot(
  snapshot: ServerRuleExecutionPendingSnapshotDto
): ServerAggregateChoicePendingSnapshotDto {
  if (!isServerAggregateChoicePendingSnapshot(snapshot)) {
    throw new Error('The pending occurrence does not retain an aggregate choice.')
  }
  return snapshot
}

/** Returns the aggregate occurrence that owns a pending movement concentration child. */
export function serverRuleExecutionPendingOccurrenceId(
  snapshot: ServerRuleExecutionPendingSnapshotDto
): string {
  return snapshot.snapshotKind === 'KERNEL_EVIDENCE' &&
    snapshot.applicationContext.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
    snapshot.applicationContext.phase.kind === 'CONCENTRATION_EVIDENCE'
    ? snapshot.applicationContext.phase.concentration.parentOccurrenceId
    : snapshot.occurrenceId
}
