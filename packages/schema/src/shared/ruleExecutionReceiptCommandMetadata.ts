import { z, lazySchema } from '../zod.js'

import { serverRuleEvidenceResponseDtoSchema } from './ruleExecutionEvidence.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  movementRuleResolutionCommandDtoSchema,
  validateCanonicalSpatialResolutionHistory
} from './ruleExecutionSpatial.js'
import { turnResolutionCommandDtoSchema } from './ruleExecutionTurnCommands.js'
import { MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS } from './ruleExecutionTurnPending.js'
import { MAX_SPATIAL_CANDIDATES, spatialMovementKindDtoSchema } from './spatialFacts.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'

const spatialMovementChangedAggregateDtoSchema = lazySchema(() =>
  z.strictObject({
    aggregateKind: z.enum(['CHARACTER', 'ENCOUNTER', 'SCENE']),
    aggregateId: uuidSchema,
    beforeVersion: aggregateVersionSchema,
    version: aggregateVersionSchema
  })
)

/** Server-only, non-executable command metadata retained with a rule receipt. */
export const serverRuleExecutionReceiptCommandMetadataDtoSchema = lazySchema(() =>
  z
    .discriminatedUnion('transition', [
      z.strictObject({
        schemaVersion: z.literal(1),
        transition: z.literal('ACTION_EVIDENCE'),
        rootCommandId: uuidSchema,
        rootCommandFingerprint: checksumSchema,
        rootInitiatorUserId: uuidSchema,
        expectedAggregateVersion: aggregateVersionSchema,
        expectedOccurrenceVersion: aggregateVersionSchema,
        requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
        resolutionKind: z.enum([
          'ENTER_DICE',
          'ENTER_INTEGER',
          'SYSTEM_ROLL',
          'CONTEST_CHECK',
          'AREA_LEGENDARY_RESISTANCE',
          'DECLINE',
          'OPTION',
          'FORCED_MOVEMENT',
          'D20_WINDOW_USE',
          'D20_WINDOW_DECLINE'
        ]),
        /**
         * Native evidence retries retain the authorized response's command receipt, parsed by its
         * API owner; the replay rebuilds its projection from the Run's records.
         */
        replayReceipt: z.optional(
          z.strictObject({ replayReceiptJson: z.string(), replayReceiptChecksum: checksumSchema })
        )
      }),
      z.strictObject({
        schemaVersion: z.literal(1),
        transition: z.literal('START'),
        definitionId: uuidSchema,
        expectedAggregateVersion: aggregateVersionSchema,
        factsChecksum: checksumSchema,
        optionalCombatSnapshotChecksum: z.optional(z.nullable(checksumSchema))
      }),
      z.strictObject({
        schemaVersion: z.literal(1),
        transition: z.literal('CONCENTRATION_END'),
        expectedAggregateVersion: aggregateVersionSchema
      }),
      z.strictObject({
        schemaVersion: z.literal(1),
        transition: z.literal('RESUME'),
        expectedAggregateVersion: aggregateVersionSchema,
        expectedOccurrenceVersion: aggregateVersionSchema,
        response: serverRuleEvidenceResponseDtoSchema,
        optionalCombatSnapshotChecksum: z.optional(z.nullable(checksumSchema))
      }),
      z.strictObject({
        schemaVersion: z.literal(1),
        transition: z.literal('OPTIONAL_COMBAT_CLEAVING'),
        commandType: z.literal('RESOLVE_RULE_OCCURRENCE'),
        expectedAggregateVersion: aggregateVersionSchema,
        expectedOccurrenceVersion: aggregateVersionSchema,
        response: z.discriminatedUnion('kind', [
          z.strictObject({ kind: z.literal('DECLINE') }),
          z.strictObject({ kind: z.literal('OPTION'), optionId: checksumSchema })
        ]),
        optionalCombatSnapshotChecksum: z.optional(z.nullable(checksumSchema))
      }),
      z.strictObject({
        schemaVersion: z.literal(1),
        transition: z.literal('TURN_EFFECTS'),
        commandType: z.enum(['START', 'ADVANCE_TURN']),
        expectedAggregateVersion: aggregateVersionSchema,
        selectionChecksum: z.nullable(checksumSchema),
        initiativeChecksum: z._default(z.nullable(checksumSchema), null),
        initiativeAdvanceChecksum: z._default(z.nullable(checksumSchema), null),
        optionalCombatSnapshotChecksum: z.optional(z.nullable(checksumSchema)),
        terminalOccurrenceVersion: aggregateVersionSchema,
        resolutionCommands: z
          .array(turnResolutionCommandDtoSchema)
          .check(
            z.maxLength(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS + MAX_ENCOUNTER_ACTORS * 20)
          )
      }),
      z.strictObject({
        schemaVersion: z.literal(1),
        transition: z.literal('TURN_EFFECTS_PENDING'),
        commandType: z.literal('RESOLVE_RULE_OCCURRENCE'),
        rootCommandId: uuidSchema,
        rootCommandFingerprint: checksumSchema,
        rootInitiatorUserId: uuidSchema,
        rootCorrelationId: z.nullable(uuidSchema),
        expectedAggregateVersion: aggregateVersionSchema,
        optionalCombatSnapshotChecksum: z.optional(z.nullable(checksumSchema)),
        occurrenceVersion: aggregateVersionSchema,
        resolutionCommand: turnResolutionCommandDtoSchema
      }),
      z.strictObject({
        schemaVersion: z.literal(1),
        transition: z.literal('SPATIAL_MOVEMENT'),
        commandType: z.enum(['MOVE_SCENE_TOKEN', 'RESOLVE_RULE_OCCURRENCE']),
        rootCommandId: uuidSchema,
        rootCommandFingerprint: checksumSchema,
        rootInitiatorUserId: uuidSchema,
        rootCorrelationId: z.nullable(uuidSchema),
        encounterId: uuidSchema,
        sceneId: uuidSchema,
        tokenId: uuidSchema,
        movementKind: spatialMovementKindDtoSchema,
        expectedEncounterVersion: aggregateVersionSchema,
        expectedSceneVersion: aggregateVersionSchema,
        rootExpectedEncounterVersion: aggregateVersionSchema,
        rootExpectedSceneVersion: aggregateVersionSchema,
        encounterVersionTransition: z.enum(['UNCHANGED', 'ADVANCED']),
        sceneVersionTransition: z.enum(['UNCHANGED', 'ADVANCED']),
        currentnessChecksum: z.nullable(checksumSchema),
        selectionChecksum: checksumSchema,
        optionalCombatSnapshotChecksum: z.optional(z.nullable(checksumSchema)),
        occurrenceVersion: aggregateVersionSchema,
        changedAggregates: z
          .array(spatialMovementChangedAggregateDtoSchema)
          .check(z.maxLength(MAX_SPATIAL_CANDIDATES + 4)),
        resolutionCommands: z
          .array(movementRuleResolutionCommandDtoSchema)
          .check(z.maxLength(MAX_SPATIAL_CANDIDATES))
      }),
      z.strictObject({
        schemaVersion: z.literal(1),
        transition: z.literal('MAINTENANCE_CLEANUP'),
        commandType: z.literal('REMOVE_ACTOR'),
        expectedAggregateVersion: aggregateVersionSchema,
        expectedOccurrenceVersion: z._default(z.nullable(aggregateVersionSchema), null),
        optionalCombatSnapshotChecksum: z.optional(z.nullable(checksumSchema)),
        removedActorId: uuidSchema
      })
    ])
    .check(
      z.superRefine((value, context) => {
        if (value.transition !== 'SPATIAL_MOVEMENT') return
        let priorAggregateKey = ''
        for (const [index, aggregate] of value.changedAggregates.entries()) {
          const key = `${aggregate.aggregateKind}:${aggregate.aggregateId}`
          if (
            key <= priorAggregateKey ||
            (aggregate.aggregateKind === 'ENCOUNTER' &&
              aggregate.aggregateId !== value.encounterId) ||
            (aggregate.aggregateKind === 'SCENE' && aggregate.aggregateId !== value.sceneId) ||
            aggregate.version <= aggregate.beforeVersion
          )
            context.addIssue({
              code: 'custom',
              path: ['changedAggregates', index],
              message:
                'Spatial changed aggregates must be unique, canonically ordered, and bound to the receipt roots.'
            })
          priorAggregateKey = key
        }
        const encounterChange = value.changedAggregates.find(
          (aggregate) => aggregate.aggregateKind === 'ENCOUNTER'
        )
        const sceneChange = value.changedAggregates.find(
          (aggregate) => aggregate.aggregateKind === 'SCENE'
        )
        const expectedEncounterChange =
          value.encounterVersionTransition === 'ADVANCED'
            ? value.expectedEncounterVersion + 1
            : null
        const expectedSceneChange =
          value.sceneVersionTransition === 'ADVANCED' ? value.expectedSceneVersion + 1 : null
        if (
          (expectedEncounterChange === null) !== (encounterChange === undefined) ||
          (encounterChange !== undefined &&
            (encounterChange.beforeVersion !== value.expectedEncounterVersion ||
              encounterChange.version !== expectedEncounterChange))
        )
          context.addIssue({
            code: 'custom',
            path: ['changedAggregates'],
            message: 'Spatial changed aggregates must retain the exact Encounter transition.'
          })
        if (
          (expectedSceneChange === null) !== (sceneChange === undefined) ||
          (sceneChange !== undefined &&
            (sceneChange.beforeVersion !== value.expectedSceneVersion ||
              sceneChange.version !== expectedSceneChange))
        )
          context.addIssue({
            code: 'custom',
            path: ['changedAggregates'],
            message: 'Spatial changed aggregates must retain the exact Scene transition.'
          })
        if (
          value.changedAggregates.some((aggregate) => aggregate.aggregateKind === 'CHARACTER') &&
          value.encounterVersionTransition !== 'ADVANCED'
        )
          context.addIssue({
            code: 'custom',
            path: ['changedAggregates'],
            message: 'A spatial Character transition must advance the owning Encounter.'
          })
        validateCanonicalSpatialResolutionHistory(value.resolutionCommands, context, [
          'resolutionCommands'
        ])
        if (value.resolutionCommands.length !== value.occurrenceVersion)
          context.addIssue({
            code: 'custom',
            path: ['resolutionCommands'],
            message: 'Spatial terminal resolution history must match the occurrence version.'
          })
        if (
          value.commandType === 'MOVE_SCENE_TOKEN' &&
          (value.occurrenceVersion !== 0 ||
            value.resolutionCommands.length !== 0 ||
            value.expectedEncounterVersion !== value.rootExpectedEncounterVersion ||
            value.expectedSceneVersion !== value.rootExpectedSceneVersion)
        )
          context.addIssue({
            code: 'custom',
            path: ['commandType'],
            message:
              'A root spatial movement receipt must be a fresh occurrence without resolutions.'
          })
        if (
          value.commandType === 'MOVE_SCENE_TOKEN' &&
          value.encounterVersionTransition === 'UNCHANGED' &&
          value.changedAggregates.some(
            (aggregate) =>
              aggregate.aggregateKind === 'CHARACTER' || aggregate.aggregateKind === 'ENCOUNTER'
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['changedAggregates'],
            message:
              'An unchanged root spatial receipt cannot retain Encounter or Character mechanics.'
          })
        if (
          value.commandType === 'RESOLVE_RULE_OCCURRENCE' &&
          value.resolutionCommands.length === 0
        )
          context.addIssue({
            code: 'custom',
            path: ['resolutionCommands'],
            message: 'A spatial resolution receipt must retain its exact resolution history.'
          })
      })
    )
)

export type ServerRuleExecutionReceiptCommandMetadataDto = z.infer<
  typeof serverRuleExecutionReceiptCommandMetadataDtoSchema
>
