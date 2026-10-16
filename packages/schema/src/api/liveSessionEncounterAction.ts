import { z, lazySchema, lazySchemaParts } from '../zod.js'
import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectLifecycleDtoSchema,
  MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
  MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR,
  type ActiveRuleEffectDefinitionDto,
  type ActiveRuleEffectLifecycleDto
} from '../shared/activeRuleEffects.js'
import {
  spatialRuleEffectPlacementDtoSchema,
  spatialRuleEffectStateDtoSchema,
  type SpatialRuleEffectPlacementDto,
  type SpatialRuleEffectStateDto
} from '../shared/spatial.js'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '../shared/ruleExecutionPendingSnapshots.js'
import {
  removeAreaTargetInputDtoSchema,
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema,
  type RemoveAreaTargetInputDto
} from './encounterRuleCommands.js'
import {
  liveSessionEncounterRulesInputSchema,
  liveSessionEncounterMaintenanceOwnerRequestSchema
} from './liveSessionEncounterRules.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { characterResourceUsageOwnerSchema } from '../projections/characterSheetState.js'
import {
  activeRuleEffectRecordSchema,
  encounterMaintainedEffectStateRecordSchema
} from '../projections/activeRuleEffectPersistence.js'
import { characterMechanicsResourceReceiptDtoSchema } from '../shared/ruleExecutionMechanics.js'
import { storedRuleExecutionResultDtoSchema } from '../shared/ruleExecutionResults.js'
import {
  characterItemConsumptionFieldsSchema,
  characterSpellSlotConsumptionFieldsSchema,
  concentrationEndDtoSchema
} from '../shared/ruleExecutionEncounterApplications.js'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '../shared/ruleExecutionReceiptCommandMetadata.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import {
  encounterRuleWarningsDtoSchema,
  type EncounterRuleWarningDto
} from '../shared/encounterRuleWarnings.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'

/** Private DO output; the mutation accepts a sealed action occurrence, never arbitrary writes. */
export const liveSessionEncounterActionPendingInputSchema = lazySchema(() =>
  z.extend(
    z.omit(liveSessionEncounterRulesInputSchema, {
      request: true,
      concentrationResponse: true,
      turnCommand: true,
      action: true,
      movement: true
    }),
    {
      /** The GM, or a player acting for an actor they control (ADR 0034 decision 1). */
      expectedRole: z.enum(['OWNER', 'PLAYER']),
      command: resolveEncounterActionInputDtoSchema,
      response: z.optional(z.nullable(resolveRuleOccurrenceInputDtoSchema)),
      revisions: liveSessionRulesRevisionsSchema,
      maintenanceOwners: z
        .array(liveSessionEncounterMaintenanceOwnerRequestSchema)
        .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR)),
      snapshot: serverRuleExecutionPendingSnapshotDtoSchema
    }
  )
)

export type LiveSessionEncounterActionPendingInput = z.infer<
  typeof liveSessionEncounterActionPendingInputSchema
>

export const liveSessionCharacterResourceConsumptionSchema = lazySchema(() =>
  z.extend(characterMechanicsResourceReceiptDtoSchema, {
    owner: characterResourceUsageOwnerSchema,
    usageId: postgresUuidSchema,
    characterId: postgresUuidSchema,
    expectedStreamVersion: z.number().check(z.int()).check(z.nonnegative())
  })
)

export const liveSessionCharacterItemConsumptionSchema = lazySchema(() =>
  z.extend(characterItemConsumptionFieldsSchema, {
    expectedStreamVersion: z.number().check(z.int()).check(z.nonnegative())
  })
)

export const liveSessionCharacterSpellConsumptionSchema = lazySchema(() =>
  z.extend(characterSpellSlotConsumptionFieldsSchema, {
    expectedStreamVersion: z.number().check(z.int()).check(z.nonnegative())
  })
)

/** Bounded domain outcomes from the private DO; no Character or Run document patches. */
export type LiveSessionEncounterActionCommitInput = Omit<
  LiveSessionEncounterActionPendingInput,
  'snapshot'
> & {
  occurredAt: string
  initialDefinitionId: string
  execution: z.infer<typeof storedRuleExecutionResultDtoSchema>
  rules: z.infer<typeof encounterActorRuleOutputSchema>
  resourceConsumption:
    | (z.infer<typeof characterMechanicsResourceReceiptDtoSchema> & {
        owner: z.infer<typeof characterResourceUsageOwnerSchema>
        usageId: string
        characterId: string
        expectedStreamVersion: number
      })
    | null
  /** The single-use item this Assisted action used up, with the Character version it was planned at. */
  itemConsumption: z.infer<typeof liveSessionCharacterItemConsumptionSchema> | null
  /** The spell slot this cast spent, with the Character version it was planned at. */
  spellConsumption: z.infer<typeof liveSessionCharacterSpellConsumptionSchema> | null
  /** The spell slot the attacked Character's reaction spent, with the Character version it was planned at. */
  reactionSpellConsumption: z.infer<typeof liveSessionCharacterSpellConsumptionSchema> | null
  /** The resolved action's display name; the stored command and the timeline carry it. */
  label: string | null
  /** Warnings the command acknowledged and the planner found; recorded as overrides. */
  ruleOverrides: EncounterRuleWarningDto[]
  createdEffects: z.infer<typeof activeRuleEffectRecordSchema>[]
  maintainedState: z.infer<typeof encounterMaintainedEffectStateRecordSchema> | null
  concentration: {
    result: z.infer<typeof storedRuleExecutionResultDtoSchema>
    commandId: string
    fingerprint: string
    correlationId: string
    metadata: z.infer<typeof serverRuleExecutionReceiptCommandMetadataDtoSchema>
  }[]
  pendingConcentration: z.infer<typeof serverRuleExecutionPendingSnapshotDtoSchema> | null
  /** Concentration slots this commit ended because their holders can't act or are defeated (D95). */
  concentrationEnds: z.infer<typeof concentrationEndDtoSchema>[]
  /** Grants their holders' incapacitation ended in this commit (D95); an action's undo restores them. */
  endedGrants: z.infer<typeof activeRuleEffectRecordSchema>[]
  cleaving: z.infer<typeof serverRuleExecutionPendingSnapshotDtoSchema> | null
  /** The attacker's grants this attack roll used up; its commit deletes them, its undo restores them. */
  consumedGrants: z.infer<typeof activeRuleEffectRecordSchema>[]
}
export const liveSessionEncounterConcentrationFields = lazySchemaParts(() => ({
  concentration: z
    .array(
      z.strictObject({
        result: storedRuleExecutionResultDtoSchema,
        commandId: postgresUuidSchema,
        fingerprint: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
        correlationId: postgresUuidSchema,
        metadata: serverRuleExecutionReceiptCommandMetadataDtoSchema
      })
    )
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  pendingConcentration: z.nullable(serverRuleExecutionPendingSnapshotDtoSchema),
  concentrationEnds: z.array(concentrationEndDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  endedGrants: z
    .array(activeRuleEffectRecordSchema)
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS * MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
}))

export const liveSessionEncounterActionCommitInputSchema: z.ZodMiniType<LiveSessionEncounterActionCommitInput> =
  lazySchema(() =>
    z.extend(z.omit(liveSessionEncounterActionPendingInputSchema, { snapshot: true }), {
      occurredAt: z.iso.datetime(),
      maintenanceOwners: z
        .array(liveSessionEncounterMaintenanceOwnerRequestSchema)
        .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR * 2)),
      initialDefinitionId: postgresUuidSchema,
      execution: storedRuleExecutionResultDtoSchema,
      rules: encounterActorRuleOutputSchema,
      resourceConsumption: z.nullable(liveSessionCharacterResourceConsumptionSchema),
      itemConsumption: z.nullable(liveSessionCharacterItemConsumptionSchema),
      spellConsumption: z.nullable(liveSessionCharacterSpellConsumptionSchema),
      reactionSpellConsumption: z.nullable(liveSessionCharacterSpellConsumptionSchema),
      label: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))),
      ruleOverrides: encounterRuleWarningsDtoSchema,
      // The action's state and recurring effects, and the effect of a reaction its target used.
      createdEffects: z.array(activeRuleEffectRecordSchema).check(z.maxLength(3)),
      maintainedState: z.nullable(encounterMaintainedEffectStateRecordSchema),
      ...liveSessionEncounterConcentrationFields(),
      cleaving: z.nullable(serverRuleExecutionPendingSnapshotDtoSchema),
      consumedGrants: z
        .array(activeRuleEffectRecordSchema)
        .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
    })
  )

/** The Scene spatial effect an action places, as the planner built it; persistence stores it as is. */
export type LiveSessionPlacedSpatialEffect = {
  id: string
  definition: ActiveRuleEffectDefinitionDto
  lifecycle: ActiveRuleEffectLifecycleDto
  placement: SpatialRuleEffectPlacementDto
  spatialState: SpatialRuleEffectStateDto
}

export const liveSessionPlacedSpatialEffectSchema: z.ZodMiniType<LiveSessionPlacedSpatialEffect> =
  lazySchema(() =>
    z.strictObject({
      id: postgresUuidSchema,
      definition: activeRuleEffectDefinitionDtoSchema,
      lifecycle: activeRuleEffectLifecycleDtoSchema,
      placement: spatialRuleEffectPlacementDtoSchema,
      spatialState: spatialRuleEffectStateDtoSchema
    })
  )

/**
 * The terminal outcome of a point-area action or of a cast on a list of chosen creatures: the root
 * with the caster's one spend, one settled outcome per kept creature, and, for an area, its final
 * snapshot the last answer produced (a chosen list never pends, so it has none). It creates no
 * maintained state or cleaving choice, so those fields do not exist here; each creature may be left
 * one lasting effect, and the action may place one spatial effect in the Scene.
 */
export type LiveSessionEncounterAreaCommitInput = Omit<
  LiveSessionEncounterActionCommitInput,
  | 'execution'
  | 'maintenanceOwners'
  | 'createdEffects'
  | 'maintainedState'
  | 'cleaving'
  | 'consumedGrants'
  | 'reactionSpellConsumption'
> & {
  execution: z.infer<typeof storedRuleExecutionResultDtoSchema>
  targets: {
    actorId: string
    execution: z.infer<typeof storedRuleExecutionResultDtoSchema>
    /** The lasting effect the action left on this creature, if any. */
    createdEffects: z.infer<typeof activeRuleEffectRecordSchema>[]
  }[]
  area: z.infer<typeof serverRuleExecutionPendingSnapshotDtoSchema> | null
  /** The GM removal that left the area settled, when it rather than an answer committed it. */
  removal: RemoveAreaTargetInputDto | null
  /** The zone this action places at the picked point, which its undo deletes; null for none. */
  placedZone: LiveSessionPlacedSpatialEffect | null
}

export const liveSessionEncounterAreaCommitInputSchema: z.ZodMiniType<LiveSessionEncounterAreaCommitInput> =
  lazySchema(() =>
    z.extend(
      z.omit(liveSessionEncounterActionPendingInputSchema, {
        snapshot: true,
        maintenanceOwners: true
      }),
      {
        occurredAt: z.iso.datetime(),
        initialDefinitionId: postgresUuidSchema,
        execution: storedRuleExecutionResultDtoSchema,
        targets: z
          .array(
            z.strictObject({
              actorId: postgresUuidSchema,
              execution: storedRuleExecutionResultDtoSchema,
              createdEffects: z.array(activeRuleEffectRecordSchema).check(z.maxLength(1))
            })
          )
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        area: z.nullable(serverRuleExecutionPendingSnapshotDtoSchema),
        removal: z.nullable(removeAreaTargetInputDtoSchema),
        placedZone: z.nullable(liveSessionPlacedSpatialEffectSchema),
        rules: encounterActorRuleOutputSchema,
        resourceConsumption: z.nullable(liveSessionCharacterResourceConsumptionSchema),
        itemConsumption: z.nullable(liveSessionCharacterItemConsumptionSchema),
        spellConsumption: z.nullable(liveSessionCharacterSpellConsumptionSchema),
        label: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))),
        ruleOverrides: encounterRuleWarningsDtoSchema,
        ...liveSessionEncounterConcentrationFields()
      }
    )
  )
