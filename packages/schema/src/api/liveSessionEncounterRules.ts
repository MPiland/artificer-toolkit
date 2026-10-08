import { z, lazySchema } from '../zod.js'
import {
  liveSessionActionCaptureScopeSchema,
  liveSessionTurnCaptureScopeSchema
} from './liveSessionCommandScopes.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { reusableDefinitionCurrentDtoSchema } from '../shared/reusableDefinitions.js'
import {
  activeRuleEffectOwnerSchema,
  activeRuleEffectRecordSchema,
  encounterMaintainedEffectStateRecordSchema
} from '../projections/activeRuleEffectPersistence.js'
import { characterStoredRowSchema } from '../projections/characterPersistence.js'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '../projections/encounterRunState.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { systemAuthoredDtoSchema } from '../vocabulary/system.js'
import { systemVocabularySnapshotSchema } from '../projections/systemVocabulary.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'
import {
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema,
  useEncounterBasicActionInputDtoSchema
} from './encounterRuleCommands.js'
import {
  serverAggregateChoicePendingSnapshotDtoSchema,
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  serverRuleExecutionPendingSnapshotDtoSchema
} from '../shared/ruleExecutionPendingSnapshots.js'
import { advanceEncounterTurnInputDtoSchema, startEncounterInputDtoSchema } from './encounters.js'
import {
  encounterCommandResultDtoSchema,
  encounterSettledAppRollDtoSchema
} from './encounterData.js'
import {
  concentrationDamageApplicationDtoSchema,
  MAX_CONCENTRATION_DAMAGE_APPLICATIONS
} from '../shared/ruleExecutionConcentration.js'
import { sceneGridDtoSchema, scenePointDtoSchema } from './vttScenes.js'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import { encounterInitiativeRoundStateDtoSchema } from '../shared/initiativeState.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import {
  sceneCurrentEntityPageInputSchema,
  sceneCurrentEntityPageSchema
} from './sceneRecipient.js'
import { sceneLiveStateHeaderSchema } from './sceneLiveState.js'
import { encounterSpatialRuleEffectRecordSchema } from '../projections/spatialRuleEffectPersistence.js'
import { liveSessionMovementCaptureScopeSchema } from './liveSessionEncounterMovement.js'
import { sceneStoredGeometrySaveSchema } from '../projections/sceneGeometryPersistence.js'

const maintenanceSlot = {
  actorId: postgresUuidSchema,
  definitionId: postgresUuidSchema
}
const maintainedOwner = {
  ...maintenanceSlot,
  stateId: postgresUuidSchema,
  owner: activeRuleEffectOwnerSchema
}
export const liveSessionEncounterMaintenanceOwnerRequestSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('MAINTENANCE_OWNER'),
    ...maintainedOwner
  })
)
const paginationCursor = lazySchema(() => z.nullable(z.string().check(z.maxLength(8192))))
const actionToken = lazySchema(() =>
  z.strictObject({
    actorId: postgresUuidSchema,
    tokenId: postgresUuidSchema,
    position: scenePointDtoSchema,
    height: z.number().check(z.positive()).check(z.lte(VTT_SCENE_LIMITS.coordinateMagnitude)),
    width: z.number().check(z.positive()).check(z.lte(VTT_SCENE_LIMITS.coordinateMagnitude)),
    rotationDegrees: z.number().check(z.gte(0)).check(z.lt(360))
  })
)

export const liveSessionEncounterTurnCommandSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    startEncounterInputDtoSchema,
    advanceEncounterTurnInputDtoSchema,
    resolveRuleOccurrenceInputDtoSchema
  ])
)

/** Private, authorized stored records for DO rules; no evaluated facts or write instructions. */
export const liveSessionEncounterRulesRequestSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('MOVEMENT_INPUTS') }),
    z.strictObject({
      kind: z.literal('TURN_COMMAND'),
      command: liveSessionEncounterTurnCommandSchema
    }),
    z.strictObject({ kind: z.literal('CONCENTRATION_RESPONSE') }),
    z.strictObject({
      kind: z.literal('ACTION_COMMAND'),
      command: resolveEncounterActionInputDtoSchema
    }),
    z.strictObject({
      kind: z.literal('ACTION_RESPONSE'),
      response: resolveRuleOccurrenceInputDtoSchema
    }),
    z.strictObject({
      kind: z.literal('CLEAVING_RESPONSE'),
      response: resolveRuleOccurrenceInputDtoSchema
    }),
    z.strictObject({
      kind: z.literal('DISARM'),
      command: z.discriminatedUnion('type', [
        resolveEncounterActionInputDtoSchema,
        resolveRuleOccurrenceInputDtoSchema
      ])
    }),
    z.strictObject({
      kind: z.literal('BASIC_ACTION'),
      command: useEncounterBasicActionInputDtoSchema
    }),
    z.strictObject({ kind: z.literal('INPUTS') }),
    z.strictObject({ kind: z.literal('INITIATIVE_ROUND') }),
    z.strictObject({ kind: z.literal('CLEAVING_BINDINGS') }),
    z.strictObject({ kind: z.literal('SYSTEM_VOCABULARY') }),
    z.strictObject({
      kind: z.literal('ACTION_SCENE'),
      command: z.pick(resolveEncounterActionInputDtoSchema, {
        actorId: true,
        targetActorId: true,
        sceneContext: true
      })
    }),
    z.strictObject({ kind: z.literal('MAINTENANCE_SLOT'), ...maintenanceSlot }),
    z.strictObject({ kind: z.literal('MAINTENANCE_STATE'), stateId: postgresUuidSchema }),
    z.strictObject({
      kind: z.literal('SCENE_PERCEPTION'),
      observerActorId: postgresUuidSchema,
      subjectActorId: postgresUuidSchema
    }),
    z.strictObject({
      kind: z.literal('SCENE_PERCEPTION_ENTITIES'),
      page: z.extend(sceneCurrentEntityPageInputSchema, {
        collection: z.enum(['tokens', 'barriers', 'darknessZones', 'lights']),
        numItems: z.number().check(z.int()).check(z.gte(1)).check(z.lte(8))
      })
    }),
    z.strictObject({
      kind: z.literal('SCENE_SPATIAL_EFFECTS'),
      sceneId: postgresUuidSchema,
      expectedSceneVersion: z.number().check(z.int()).check(z.nonnegative()),
      afterEffectId: z.nullable(postgresUuidSchema)
    }),
    z.strictObject({
      kind: z.literal('MAINTENANCE_DEPENDENTS'),
      ...maintenanceSlot,
      stateId: postgresUuidSchema,
      ownerKind: z.enum(['CHARACTER', 'ENCOUNTER_ACTOR']),
      cursor: paginationCursor
    }),
    liveSessionEncounterMaintenanceOwnerRequestSchema,
    z.strictObject({
      kind: z.literal('MAINTENANCE_OWNER_EFFECTS'),
      ...maintainedOwner,
      afterEffectId: z.nullable(postgresUuidSchema)
    }),
    z.strictObject({ kind: z.literal('ACTOR'), actorId: postgresUuidSchema }),
    z.strictObject({
      kind: z.literal('EFFECTS'),
      actorId: postgresUuidSchema,
      afterEffectId: z.nullable(postgresUuidSchema)
    }),
    z.strictObject({ kind: z.literal('DEFINITION'), definitionId: postgresUuidSchema })
  ])
)

/**
 * Each actor's roller preference for the admitted command: the initiator's for actors they
 * control, the actor's primary controller's otherwise (ADR 0034 decision 3).
 */
const encounterAutoRollByActorIdSchema = lazySchema(() =>
  z
    .record(postgresUuidSchema, z.boolean())
    .check(z.refine((value) => Object.keys(value).length <= MAX_ENCOUNTER_ACTORS))
)

export const liveSessionEncounterRulesInputSchema = lazySchema(() =>
  z.extend(liveSessionBootstrapInputSchema, {
    expectedRole: z.enum(['OWNER', 'PLAYER']),
    concentrationResponse: z.optional(resolveRuleOccurrenceInputDtoSchema),
    turnCommand: z.optional(liveSessionTurnCaptureScopeSchema),
    action: z.optional(liveSessionActionCaptureScopeSchema),
    movement: z.optional(liveSessionMovementCaptureScopeSchema),
    encounterId: postgresUuidSchema,
    expectedVersion: z.number().check(z.int()).check(z.nonnegative()),
    request: liveSessionEncounterRulesRequestSchema
  })
)

/** An Encounter capture's Run INPUTS: its state and System. */
export const liveSessionEncounterInputsResponseSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('INPUTS'),
    revisions: liveSessionRulesRevisionsSchema,
    state: encounterRunStateSchema,
    system: systemAuthoredDtoSchema
  })
)

export const liveSessionEncounterRulesResponseSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('MOVEMENT_INPUTS'),
      revisions: liveSessionRulesRevisionsSchema,
      campaignOwnerUserId: postgresUuidSchema,
      autoRollByActorId: encounterAutoRollByActorIdSchema,
      /** The app roll a movement response settles with; null for any other answer. */
      appRoll: z.nullable(encounterSettledAppRollDtoSchema),
      save: sceneStoredGeometrySaveSchema,
      header: sceneLiveStateHeaderSchema,
      bindings: z
        .array(z.strictObject({ actorId: postgresUuidSchema, tokenId: postgresUuidSchema }))
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    }),
    z.strictObject({
      kind: z.literal('TURN_COMMAND'),
      revisions: liveSessionRulesRevisionsSchema,
      campaignOwnerUserId: postgresUuidSchema,
      /** The GM's preference for the GM's own turn step: initiative. */
      autoRollDice: z.boolean(),
      /**
       * Each actor's roller preference for its own turn dice (turn-effect saves, Recharge, Legendary
       * Actions, Concentration).
       */
      autoRollByActorId: encounterAutoRollByActorIdSchema,
      /** Actors the issuing member controls; an actor's turn step is answered by its controllers. */
      responderControlledActorIds: z
        .array(postgresUuidSchema)
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      appRoll: z.nullable(encounterSettledAppRollDtoSchema),
      command: liveSessionEncounterTurnCommandSchema,
      fingerprint: projectionChecksumSchema,
      occurrenceVersion: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
      snapshot: z.nullable(serverRuleExecutionPendingSnapshotDtoSchema),
      result: z.nullable(encounterCommandResultDtoSchema)
    }),
    z.strictObject({
      kind: z.literal('CONCENTRATION_RESPONSE'),
      revisions: liveSessionRulesRevisionsSchema,
      fingerprint: projectionChecksumSchema,
      /** Each remaining check's roller preference; auto-roll settles it in the answering commit (D23). */
      autoRollByActorId: encounterAutoRollByActorIdSchema,
      appRoll: z.nullable(encounterSettledAppRollDtoSchema),
      state: encounterRunStateSchema,
      snapshot: z.nullable(serverKernelRuleExecutionPendingSnapshotDtoSchema),
      parentApplications: z
        .array(concentrationDamageApplicationDtoSchema)
        .check(z.maxLength(MAX_CONCENTRATION_DAMAGE_APPLICATIONS)),
      result: z.nullable(encounterCommandResultDtoSchema)
    }),
    z.strictObject({
      kind: z.literal('CLEAVING_BINDINGS'),
      revisions: liveSessionRulesRevisionsSchema,
      bindings: z
        .array(z.strictObject({ actorId: postgresUuidSchema, tokenId: postgresUuidSchema }))
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    }),
    z.strictObject({
      kind: z.literal('INITIATIVE_ROUND'),
      revisions: liveSessionRulesRevisionsSchema,
      state: z.nullable(encounterInitiativeRoundStateDtoSchema)
    }),
    z.strictObject({
      kind: z.literal('SYSTEM_VOCABULARY'),
      revisions: liveSessionRulesRevisionsSchema,
      snapshot: systemVocabularySnapshotSchema
    }),
    z.strictObject({
      kind: z.literal('ACTION_SCENE'),
      revisions: liveSessionRulesRevisionsSchema,
      context: z.nullable(
        z.strictObject({
          sceneId: postgresUuidSchema,
          sceneVersion: z.number().check(z.int()).check(z.nonnegative()),
          sceneGrid: sceneGridDtoSchema,
          sourceToken: actionToken,
          targetToken: actionToken
        })
      )
    }),
    z.strictObject({
      kind: z.literal('MAINTENANCE_SLOT'),
      revisions: liveSessionRulesRevisionsSchema,
      state: z.nullable(encounterMaintainedEffectStateRecordSchema)
    }),
    z.strictObject({
      kind: z.literal('MAINTENANCE_STATE'),
      revisions: liveSessionRulesRevisionsSchema,
      state: z.nullable(encounterMaintainedEffectStateRecordSchema)
    }),
    z.strictObject({
      kind: z.literal('SCENE_PERCEPTION'),
      revisions: liveSessionRulesRevisionsSchema,
      context: z.nullable(
        z.strictObject({
          header: sceneLiveStateHeaderSchema,
          observerTokenId: postgresUuidSchema,
          subjectTokenId: postgresUuidSchema
        })
      )
    }),
    z.strictObject({
      kind: z.literal('SCENE_PERCEPTION_ENTITIES'),
      revisions: liveSessionRulesRevisionsSchema,
      page: sceneCurrentEntityPageSchema
    }),
    z.strictObject({
      kind: z.literal('SCENE_SPATIAL_EFFECTS'),
      revisions: liveSessionRulesRevisionsSchema,
      sceneId: postgresUuidSchema,
      sceneVersion: z.number().check(z.int()).check(z.nonnegative()),
      effects: z.array(encounterSpatialRuleEffectRecordSchema).check(z.maxLength(4)),
      continueAfter: z.nullable(postgresUuidSchema)
    }),
    z.strictObject({
      kind: z.literal('MAINTENANCE_DEPENDENTS'),
      revisions: liveSessionRulesRevisionsSchema,
      effects: z.array(activeRuleEffectRecordSchema).check(z.maxLength(4)),
      continueCursor: paginationCursor
    }),
    z.strictObject({
      kind: z.literal('MAINTENANCE_OWNER'),
      revisions: liveSessionRulesRevisionsSchema,
      owner: activeRuleEffectOwnerSchema,
      character: z.nullable(characterStoredRowSchema)
    }),
    z.strictObject({
      kind: z.literal('MAINTENANCE_OWNER_EFFECTS'),
      revisions: liveSessionRulesRevisionsSchema,
      owner: activeRuleEffectOwnerSchema,
      effects: z.array(activeRuleEffectRecordSchema).check(z.maxLength(4)),
      continueAfter: z.nullable(postgresUuidSchema)
    }),
    z.strictObject({
      kind: z.literal('ACTION_COMMAND'),
      revisions: liveSessionRulesRevisionsSchema,
      autoRollByActorId: encounterAutoRollByActorIdSchema,
      command: resolveEncounterActionInputDtoSchema,
      fingerprint: projectionChecksumSchema,
      result: z.nullable(encounterCommandResultDtoSchema)
    }),
    z.strictObject({
      kind: z.literal('ACTION_RESPONSE'),
      revisions: liveSessionRulesRevisionsSchema,
      autoRollByActorId: encounterAutoRollByActorIdSchema,
      appRoll: z.nullable(encounterSettledAppRollDtoSchema),
      command: resolveEncounterActionInputDtoSchema,
      fingerprint: projectionChecksumSchema,
      result: z.nullable(encounterCommandResultDtoSchema),
      snapshot: z.nullable(serverKernelRuleExecutionPendingSnapshotDtoSchema)
    }),
    z.strictObject({
      kind: z.literal('CLEAVING_RESPONSE'),
      revisions: liveSessionRulesRevisionsSchema,
      fingerprint: projectionChecksumSchema,
      /** Each remaining Concentration check's roller preference, the responder as initiator (D23). */
      autoRollByActorId: encounterAutoRollByActorIdSchema,
      /** The sealed choice being answered; null only on replay. */
      snapshot: z.nullable(serverAggregateChoicePendingSnapshotDtoSchema),
      result: z.nullable(encounterCommandResultDtoSchema)
    }),
    z.strictObject({
      kind: z.literal('DISARM'),
      revisions: liveSessionRulesRevisionsSchema,
      /** An admitted Disarm to plan; null when `result` replays a stored one. */
      ready: z.nullable(
        z.strictObject({
          /** The normalized Disarm root and its fingerprint; a d20 answer continues it. */
          command: resolveEncounterActionInputDtoSchema,
          fingerprint: projectionChecksumSchema,
          initiatorUserId: postgresUuidSchema,
          /** Each participant's d20 goes to that actor's controllers (ADR 0034 decision 3). */
          autoRollByActorId: encounterAutoRollByActorIdSchema,
          /** The app roll a `SYSTEM_ROLL` answer settles with; null for any other answer. */
          appRoll: z.nullable(encounterSettledAppRollDtoSchema),
          /** The pending contest being answered and its version; null for a new Disarm. */
          snapshot: z.nullable(serverKernelRuleExecutionPendingSnapshotDtoSchema),
          occurrenceVersion: z.nullable(z.number().check(z.int()).check(z.nonnegative()))
        })
      ),
      result: z.nullable(encounterCommandResultDtoSchema)
    }),
    z.strictObject({
      kind: z.literal('BASIC_ACTION'),
      revisions: liveSessionRulesRevisionsSchema,
      /** The admitted basic action to plan; null when `result` replays a stored one. */
      ready: z.nullable(
        z.strictObject({
          command: useEncounterBasicActionInputDtoSchema,
          fingerprint: projectionChecksumSchema
        })
      ),
      result: z.nullable(encounterCommandResultDtoSchema)
    }),
    liveSessionEncounterInputsResponseSchema,
    z.strictObject({
      kind: z.literal('ACTOR'),
      revisions: liveSessionRulesRevisionsSchema,
      actor: encounterRunActorStateSchema,
      /** Whether the actor is a Character that is dead (D96); read from its play state, never stored on the Run. */
      characterDead: z.boolean(),
      effects: z.array(activeRuleEffectRecordSchema).check(z.maxLength(4)),
      continueAfter: z.nullable(postgresUuidSchema)
    }),
    z.strictObject({
      kind: z.literal('EFFECTS'),
      revisions: liveSessionRulesRevisionsSchema,
      actorId: postgresUuidSchema,
      effects: z.array(activeRuleEffectRecordSchema).check(z.maxLength(4)),
      continueAfter: z.nullable(postgresUuidSchema)
    }),
    z.strictObject({
      kind: z.literal('DEFINITION'),
      revisions: liveSessionRulesRevisionsSchema,
      definition: z.nullable(reusableDefinitionCurrentDtoSchema)
    })
  ])
)

export type LiveSessionEncounterRulesRequest = z.infer<
  typeof liveSessionEncounterRulesRequestSchema
>
export type LiveSessionEncounterRulesInput = z.infer<typeof liveSessionEncounterRulesInputSchema>
export type LiveSessionEncounterRulesResponse = z.infer<
  typeof liveSessionEncounterRulesResponseSchema
>
