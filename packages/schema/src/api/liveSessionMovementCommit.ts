import { z, lazySchema, lazySchemaParts } from '../zod.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'
import { liveSessionSequenceDtoSchema } from './liveSessionCommands.js'
import { liveSessionMovementCaptureScopeSchema } from './liveSessionEncounterMovement.js'
import {
  sceneGeometryCommandResultSchema,
  sceneGeometryFinishInputSchema,
  scenePresentationFenceSchema
} from './sceneGeometry.js'
import {
  bindEncounterToPresentedSceneInputDtoSchema,
  sceneDeltaDtoSchema,
  sceneFogLayerDtoSchema
} from './vttScenes.js'
import { encounterCommandResultDtoSchema } from './encounterData.js'
import { voidRuleOccurrenceInputDtoSchema } from './encounterRuleCommands.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { sceneSpatialPreparationSchema } from '../projections/sceneSpatialPreparation.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'
import { liveSessionCharacterResourceConsumptionSchema } from './liveSessionEncounterAction.js'
import { liveSessionEncounterMaintenanceOwnerRequestSchema } from './liveSessionEncounterRules.js'
import { MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR } from '../shared/activeRuleEffects.js'
import {
  spatialMovementExecutionDtoSchema,
  spatialEffectTransitionEntryDtoSchema
} from '../shared/ruleExecutionEffectEvidence.js'
import { movementReactionActionExecutionDtoSchema } from '../shared/ruleExecutionMovementReactionReceipts.js'
import { movementConcentrationExecutionDtoSchema } from '../shared/ruleExecutionMovementConcentration.js'
import { movementPassageContestReceiptDtoSchema } from '../shared/ruleExecutionSpatial.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  activeRuleEffectRecordSchema,
  encounterMaintainedEffectStateRecordSchema
} from '../projections/activeRuleEffectPersistence.js'
import { MAX_SPATIAL_CANDIDATES } from '../shared/spatialFacts.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { encounterAllyAdvantageUsesDtoSchema } from '../shared/basicActions.js'

/** Ordered domain outcomes only; Character documents and arbitrary patches never cross this seam. */
export const liveSessionMovementSettlementSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('SPATIAL'),
      executions: z
        .array(spatialMovementExecutionDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      transitions: z
        .array(spatialEffectTransitionEntryDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES))
    }),
    z.strictObject({
      kind: z.literal('REACTION'),
      execution: movementReactionActionExecutionDtoSchema,
      resourceConsumption: z.nullable(liveSessionCharacterResourceConsumptionSchema),
      createdEffects: z.array(activeRuleEffectRecordSchema).check(z.maxLength(2)),
      maintainedState: z.nullable(encounterMaintainedEffectStateRecordSchema),
      /** The Help (basic action, Q11) the reactor's attack roll used. */
      allyAdvantageUses: encounterAllyAdvantageUsesDtoSchema
    }),
    z.strictObject({
      kind: z.literal('CONCENTRATION'),
      execution: movementConcentrationExecutionDtoSchema
    }),
    z.strictObject({
      kind: z.literal('PASSAGE'),
      actorId: postgresUuidSchema,
      consumption: movementPassageContestReceiptDtoSchema.shape.actionEconomy,
      /** The Helps (basic action, Q11) the contest's checks used. */
      allyAdvantageUses: encounterAllyAdvantageUsesDtoSchema
    })
  ])
)

/**
 * The room's frozen movement plan and the captured reads it rests on. The movement commit checks
 * every captured owner and persists the plan on its save before it publishes, in one transaction.
 */
export const liveSessionMovementPrepareInputSchema = lazySchema(() =>
  z.extend(liveSessionBootstrapInputSchema, {
    expectedRole: z.enum(['OWNER', 'PLAYER']),
    movement: liveSessionMovementCaptureScopeSchema,
    preparation: sceneSpatialPreparationSchema,
    revisions: liveSessionRulesRevisionsSchema,
    maintenanceOwners: z
      .array(liveSessionEncounterMaintenanceOwnerRequestSchema)
      .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR * MAX_ENCOUNTER_ACTORS))
  })
)

/**
 * The room's next authority sequence, which a Convex-first commit advances in its own transaction
 * (D27): Convex requires its persisted sequence to be `sequence - 1` with `expectedStateChecksum`.
 */
export const liveSessionExternalAuthoritySchema = lazySchema(() =>
  z.strictObject({
    sequence: liveSessionSequenceDtoSchema.check(z.positive()),
    expectedStateChecksum: projectionChecksumSchema,
    stateChecksum: projectionChecksumSchema
  })
)

/** The Scene result the room predicted; any other publication rolls the whole commit back. */
export const liveSessionExpectedSceneSchema = lazySchema(() =>
  z.strictObject({
    sceneId: postgresUuidSchema,
    version: z.number().check(z.int()).check(z.nonnegative()),
    delta: z.nullable(sceneDeltaDtoSchema)
  })
)

/**
 * Every room Scene commit also stages each fog owner's complete layer on its save, in the commit's
 * own transaction (D52); a retry of a published save stages nothing again.
 */
const externalCommit = lazySchemaParts(() => ({
  authority: liveSessionExternalAuthoritySchema,
  expectedScene: liveSessionExpectedSceneSchema,
  fogLayers: z.array(sceneFogLayerDtoSchema).check(z.maxLength(101))
}))

/** A room Scene commit that carries no Encounter rules: a token move or a door change. */
export const liveSessionSceneGeometryCommitInputSchema = lazySchema(() =>
  z.extend(liveSessionBootstrapInputSchema, {
    finish: sceneGeometryFinishInputSchema,
    ...externalCommit()
  })
)

/**
 * A room Encounter binding (D47): the GM binds an Encounter to the room's presented Scene. Convex
 * refuses it once its clock passes `expiresAt`, so a resolve after that time can settle it as
 * ABANDONED without a delayed commit landing later.
 */
export const liveSessionEncounterBindingCommitInputSchema = lazySchema(() =>
  z.extend(liveSessionBootstrapInputSchema, {
    command: bindEncounterToPresentedSceneInputDtoSchema,
    sceneId: postgresUuidSchema,
    presentation: scenePresentationFenceSchema,
    authority: liveSessionExternalAuthoritySchema,
    expiresAt: z.number().check(z.int()).check(z.positive())
  })
)

/** What a room commit changes, so a resolve can tell whether it landed. */
export const liveSessionExternalCommitSubjectSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('SCENE_SAVE'), saveId: postgresUuidSchema }),
    z.strictObject({
      kind: z.literal('ENCOUNTER_BINDING'),
      encounterId: postgresUuidSchema,
      commandId: postgresUuidSchema,
      expiresAt: liveSessionEncounterBindingCommitInputSchema.shape.expiresAt
    })
  ])
)

/**
 * Settles a room commit whose outcome the room did not observe (a timeout or a restart). Worker
 * secret only: the room's write-ahead record supplies every field.
 */
export const liveSessionExternalCommitResolveInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    epoch: postgresUuidSchema,
    subject: liveSessionExternalCommitSubjectSchema,
    expectedSequence: liveSessionSequenceDtoSchema,
    expectedStateChecksum: projectionChecksumSchema,
    nextStateChecksum: projectionChecksumSchema
  })
)
export const liveSessionExternalCommitResolveResponseSchema = lazySchema(() =>
  z.strictObject({
    outcome: z.enum(['COMMITTED', 'ABANDONED'])
  })
)

export const liveSessionMovementCommitInputSchema = lazySchema(() =>
  z.extend(liveSessionMovementPrepareInputSchema, {
    finish: sceneGeometryFinishInputSchema,
    ...externalCommit(),
    /** A GM void this commit declines (D26); it is recorded in the same transaction. */
    voidCommand: z.optional(voidRuleOccurrenceInputDtoSchema),
    rules: z.nullable(encounterActorRuleOutputSchema),
    settlements: z
      .array(liveSessionMovementSettlementSchema)
      .check(
        z.maxLength(MAX_SPATIAL_CANDIDATES + MAX_ENCOUNTER_ACTORS * (MAX_ENCOUNTER_ACTORS + 1))
      )
  })
)

/** A decision answer or void also returns its Encounter result, presented for the member. */
export const liveSessionMovementCommitResponseSchema = lazySchema(() =>
  z.strictObject({
    scene: sceneGeometryCommandResultSchema,
    encounter: z.nullable(encounterCommandResultDtoSchema)
  })
)

export type LiveSessionMovementSettlement = z.infer<typeof liveSessionMovementSettlementSchema>
export type LiveSessionExternalAuthority = z.infer<typeof liveSessionExternalAuthoritySchema>
export type LiveSessionExpectedScene = z.infer<typeof liveSessionExpectedSceneSchema>
export type LiveSessionSceneGeometryCommitInput = z.infer<
  typeof liveSessionSceneGeometryCommitInputSchema
>
export type LiveSessionExternalCommitResolveInput = z.infer<
  typeof liveSessionExternalCommitResolveInputSchema
>
export type LiveSessionExternalCommitSubject = z.infer<
  typeof liveSessionExternalCommitSubjectSchema
>
export type LiveSessionEncounterBindingCommitInput = z.infer<
  typeof liveSessionEncounterBindingCommitInputSchema
>
export type LiveSessionMovementCommitResponse = z.infer<
  typeof liveSessionMovementCommitResponseSchema
>
export type LiveSessionMovementPrepareInput = z.infer<typeof liveSessionMovementPrepareInputSchema>
export type LiveSessionMovementCommitInput = z.infer<typeof liveSessionMovementCommitInputSchema>
