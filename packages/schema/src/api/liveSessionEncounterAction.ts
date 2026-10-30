import type { ForcedMovementDirection } from '@artificer-toolkit/shared/core'
import { z, lazySchema, lazySchemaParts } from '../zod.js'
import { forcedMovementDirectionSchema } from '../shared/enums.js'
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
import { ruleExecutionChecksumSchema } from '../shared/ruleExecutionPrimitives.js'
import { characterResourceUsageOwnerSchema } from '../projections/characterSheetState.js'
import { encounterTurnUseKeysSchema } from '../projections/encounterRunPersistence.js'
import {
  activeRuleEffectRecordSchema,
  encounterMaintainedEffectStateRecordSchema
} from '../projections/activeRuleEffectPersistence.js'
import { characterMechanicsResourceReceiptDtoSchema } from '../shared/ruleExecutionMechanics.js'
import { storedRuleExecutionResultDtoSchema } from '../shared/ruleExecutionResults.js'
import {
  encounterFailedCounterReceiptDtoSchema,
  type EncounterFailedCounterReceiptDto
} from '../shared/ruleExecutionReactionChoice.js'
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
import { authoredIdentifierSchema, MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { spatialPointDtoSchema, type SpatialPointDto } from '../shared/spatialFacts.js'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '../projections/encounterRunState.js'
import { sceneStoredTokenDtoSchema } from './vttScenes.js'
import type { SceneToken } from '@artificer-toolkit/shared/vtt'

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

/** A failed counter's settled receipt with the reactor slot request the commit spends (D127). */
export type LiveSessionFailedCounter = {
  receipt: EncounterFailedCounterReceiptDto
  spellConsumption: z.infer<typeof liveSessionCharacterSpellConsumptionSchema> | null
}

const liveSessionFailedCountersSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        receipt: encounterFailedCounterReceiptDtoSchema,
        spellConsumption: z.nullable(liveSessionCharacterSpellConsumptionSchema)
      })
    )
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
)

/**
 * A creature an action's outcome moves (D139, D157): away from or toward the acting creature along
 * the straight line, aside within its reach, or in any direction, by an exact or up-to distance. The
 * room settles it on the Encounter's Scene in the commit, at `position` when its source chose one.
 */
export type LiveSessionForcedMovementCollision = {
  /** The damage dice for each full 10 feet travelled, such as `1d6`. */
  diceConfig: string
  damageTypeId: string
  /** The ability of the save a struck creature makes against `dc`. */
  abilityDefinitionId: string
  dc: number
  /** The condition a struck creature that fails the save is left with. */
  conditionId: string
}

export type LiveSessionForcedMovement = {
  targetActorId: string
  direction: ForcedMovementDirection
  feet: number
  upTo: boolean
  /** The reach of the action an ASIDE move stays within; null for every other direction. */
  sourceReachFeet: number | null
  position: SpatialPointDto | null
  /** The line a `RANDOM` move follows, rolled once when the action was planned; null for every other direction. */
  ray: SpatialPointDto | null
  /** What the move does where it strikes an object or a creature (D159); null for a move that does nothing there. */
  collision: LiveSessionForcedMovementCollision | null
}

export const liveSessionForcedMovementsSchema: z.ZodMiniType<LiveSessionForcedMovement[]> =
  lazySchema(() =>
    z
      .array(
        z.strictObject({
          targetActorId: postgresUuidSchema,
          direction: forcedMovementDirectionSchema,
          feet: z.number().check(z.positive()),
          upTo: z.boolean(),
          sourceReachFeet: z.nullable(z.number().check(z.nonnegative())),
          position: z.nullable(spatialPointDtoSchema),
          ray: z.nullable(spatialPointDtoSchema),
          collision: z.nullable(
            z.strictObject({
              diceConfig: authoredIdentifierSchema,
              damageTypeId: postgresUuidSchema,
              abilityDefinitionId: postgresUuidSchema,
              dc: z.number().check(z.int()),
              conditionId: postgresUuidSchema
            })
          )
        })
      )
      .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
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
  /** The counters reactors attempted and failed against this cast, each spent with this commit (D127). */
  failedCounters: LiveSessionFailedCounter[]
  /** The planned action's display name; the stored command, the timeline and its roll cards carry it (D150). */
  label: string
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
  /** The spell's per-effect ability checks, pending on the caster's d20 under this cast's root (D182a). */
  spellCheck?: z.infer<typeof serverRuleExecutionPendingSnapshotDtoSchema>
  /** The attacker's grants this attack roll used up; its commit deletes them, its undo restores them. */
  consumedGrants: z.infer<typeof activeRuleEffectRecordSchema>[]
  /**
   * The effects that spent one counted use without ending, as they were before it: the target's
   * attack decoys the attack roll destroyed, and the carrier of the repeat the action took.
   */
  spentUseGrants: z.infer<typeof activeRuleEffectRecordSchema>[]
  /** The once-per-turn uses this attack spent from the attacker's turn record; its undo gives them back. */
  turnUses: z.infer<typeof encounterTurnUseKeysSchema>
  /** The forced movements this action's outcomes settle on the Scene in its commit (D139). */
  forcedMovements: LiveSessionForcedMovement[]
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
      failedCounters: liveSessionFailedCountersSchema,
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
      ruleOverrides: encounterRuleWarningsDtoSchema,
      // The action's state and recurring effects, and the effect of a reaction its target used.
      createdEffects: z.array(activeRuleEffectRecordSchema).check(z.maxLength(3)),
      maintainedState: z.nullable(encounterMaintainedEffectStateRecordSchema),
      ...liveSessionEncounterConcentrationFields(),
      cleaving: z.nullable(serverRuleExecutionPendingSnapshotDtoSchema),
      spellCheck: z.optional(serverRuleExecutionPendingSnapshotDtoSchema),
      consumedGrants: z
        .array(activeRuleEffectRecordSchema)
        .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
      spentUseGrants: z.array(activeRuleEffectRecordSchema).check(z.maxLength(2)),
      turnUses: encounterTurnUseKeysSchema,
      forcedMovements: liveSessionForcedMovementsSchema
    })
  )

/**
 * The terminal outcome of a cast that another creature countered: the caster's one spend and the
 * reactor's, recorded on one root. Nothing of the spell applies, so it creates no effect, damage or
 * Concentration. Casting it still uses up the caster's grants that end on a cast.
 */
export type LiveSessionEncounterCounteredCastCommitInput = Omit<
  LiveSessionEncounterActionCommitInput,
  | 'maintenanceOwners'
  | 'createdEffects'
  | 'maintainedState'
  | 'concentration'
  | 'pendingConcentration'
  | 'concentrationEnds'
  | 'endedGrants'
  | 'cleaving'
  | 'turnUses'
  | 'spentUseGrants'
  | 'forcedMovements'
>

/** What a terminal commit of an action that did nothing carries: its source's one spend and the grants it used up. */
const lostActionCommitFields = () => ({
  occurredAt: z.iso.datetime(),
  initialDefinitionId: postgresUuidSchema,
  execution: storedRuleExecutionResultDtoSchema,
  rules: encounterActorRuleOutputSchema,
  resourceConsumption: z.nullable(liveSessionCharacterResourceConsumptionSchema),
  itemConsumption: z.nullable(liveSessionCharacterItemConsumptionSchema),
  spellConsumption: z.nullable(liveSessionCharacterSpellConsumptionSchema),
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
  ruleOverrides: encounterRuleWarningsDtoSchema,
  consumedGrants: z
    .array(activeRuleEffectRecordSchema)
    .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
})

const lostActionCommitBase = () =>
  z.omit(liveSessionEncounterActionPendingInputSchema, {
    snapshot: true,
    maintenanceOwners: true
  })

export const liveSessionEncounterCounteredCastCommitInputSchema: z.ZodMiniType<LiveSessionEncounterCounteredCastCommitInput> =
  lazySchema(() =>
    z.extend(lostActionCommitBase(), {
      ...lostActionCommitFields(),
      reactionSpellConsumption: z.nullable(liveSessionCharacterSpellConsumptionSchema),
      failedCounters: liveSessionFailedCountersSchema
    })
  )

/**
 * The terminal outcome of an attack or harmful spell a warded creature's gate stopped: the source's one
 * spend, recorded on one root. Nothing of the action applies, so it creates no effect, damage or
 * Concentration. Taking the action still uses up the source's grants that end on an attack or a cast.
 */
export type LiveSessionEncounterGatedActionCommitInput = Omit<
  LiveSessionEncounterCounteredCastCommitInput,
  'reactionSpellConsumption' | 'failedCounters'
> & {
  /** The facts the gated action was prepared against; its receipt names them, as no graph ran. */
  currentnessChecksum: string
}

export const liveSessionEncounterGatedActionCommitInputSchema: z.ZodMiniType<LiveSessionEncounterGatedActionCommitInput> =
  lazySchema(() =>
    z.extend(lostActionCommitBase(), {
      ...lostActionCommitFields(),
      currentnessChecksum: ruleExecutionChecksumSchema
    })
  )

/** The Scene spatial effect an action places, as the planner built it; persistence stores it as is. */
export type LiveSessionPlacedSpatialEffect = {
  id: string
  /** The Concentration the placing cast opens (or joins); null when the zone does not depend on one. */
  maintainedEffectStateId: string | null
  definition: ActiveRuleEffectDefinitionDto
  lifecycle: ActiveRuleEffectLifecycleDto
  placement: SpatialRuleEffectPlacementDto
  spatialState: SpatialRuleEffectStateDto
}

export const liveSessionPlacedSpatialEffectSchema: z.ZodMiniType<LiveSessionPlacedSpatialEffect> =
  lazySchema(() =>
    z.strictObject({
      id: postgresUuidSchema,
      maintainedEffectStateId: z.nullable(postgresUuidSchema),
      definition: activeRuleEffectDefinitionDtoSchema,
      lifecycle: activeRuleEffectLifecycleDtoSchema,
      placement: spatialRuleEffectPlacementDtoSchema,
      spatialState: spatialRuleEffectStateDtoSchema
    })
  )

/** The creature an action conjures: the Encounter actor the cast creates, and its Scene token. */
export type LiveSessionSummonedToken = { actor: EncounterRunActorState; token: SceneToken }

export const liveSessionSummonedTokenSchema: z.ZodMiniType<LiveSessionSummonedToken> = lazySchema(
  () => z.strictObject({ actor: encounterRunActorStateSchema, token: sceneStoredTokenDtoSchema })
)

/**
 * The terminal outcome of a point-area action or of a cast on a list of chosen creatures: the root
 * with the caster's one spend, one settled outcome per kept creature, and, for an area, its final
 * snapshot the last answer produced (a chosen list that asked for no save never pends, so it has none).
 * It creates no cleaving choice, so that field does not exist here; each creature may be left one
 * lasting effect (all held by the one maintained state when the action needs Concentration), and the
 * action may place one spatial effect in the Scene.
 */
export type LiveSessionEncounterAreaCommitInput = Omit<
  LiveSessionEncounterActionCommitInput,
  | 'execution'
  | 'createdEffects'
  | 'cleaving'
  | 'turnUses'
  | 'spentUseGrants'
  | 'reactionSpellConsumption'
> & {
  execution: z.infer<typeof storedRuleExecutionResultDtoSchema>
  targets: {
    actorId: string
    execution: z.infer<typeof storedRuleExecutionResultDtoSchema>
    /** The lasting effect the action left on this creature, if any. */
    createdEffects: z.infer<typeof activeRuleEffectRecordSchema>[]
  }[]
  /**
   * Whether every entry of `targets` rolled its own dice (a projectile list names a creature once
   * per projectile) rather than sharing the one roll of an area or a list of different creatures.
   */
  rollsPerTarget: boolean
  area: z.infer<typeof serverRuleExecutionPendingSnapshotDtoSchema> | null
  /** The caught creatures the action had no effect on, which took no save. */
  unaffectedActorIds: string[]
  /** The GM removal that left the area settled, when it rather than an answer committed it. */
  removal: RemoveAreaTargetInputDto | null
  /**
   * The records this action places where it was aimed, which its undo deletes: a zone's own, then one
   * per band beside its wall (D154). Empty for none.
   */
  placedZones: LiveSessionPlacedSpatialEffect[]
  /** The timed grant the placed zone gives its placer (D153); null for none. */
  zoneSourceGrant: z.infer<typeof activeRuleEffectRecordSchema> | null
  /** The creature the cast conjures onto the Encounter's Scene in its own commit; its undo removes it. Empty for none. */
  summonedTokens: LiveSessionSummonedToken[]
}

export const liveSessionEncounterAreaCommitInputSchema: z.ZodMiniType<LiveSessionEncounterAreaCommitInput> =
  lazySchema(() =>
    z.extend(z.omit(liveSessionEncounterActionPendingInputSchema, { snapshot: true }), {
      occurredAt: z.iso.datetime(),
      maintenanceOwners: z
        .array(liveSessionEncounterMaintenanceOwnerRequestSchema)
        .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR * 2)),
      /** The one Concentration state every creature's maintained effect belongs to; null for none. */
      maintainedState: z.nullable(encounterMaintainedEffectStateRecordSchema),
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
      rollsPerTarget: z.boolean(),
      area: z.nullable(serverRuleExecutionPendingSnapshotDtoSchema),
      unaffectedActorIds: z.array(postgresUuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      removal: z.nullable(removeAreaTargetInputDtoSchema),
      placedZones: z.array(liveSessionPlacedSpatialEffectSchema).check(z.maxLength(5)),
      zoneSourceGrant: z.nullable(activeRuleEffectRecordSchema),
      summonedTokens: z.array(liveSessionSummonedTokenSchema).check(z.maxLength(1)),
      rules: encounterActorRuleOutputSchema,
      resourceConsumption: z.nullable(liveSessionCharacterResourceConsumptionSchema),
      itemConsumption: z.nullable(liveSessionCharacterItemConsumptionSchema),
      spellConsumption: z.nullable(liveSessionCharacterSpellConsumptionSchema),
      failedCounters: liveSessionFailedCountersSchema,
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
      ruleOverrides: encounterRuleWarningsDtoSchema,
      consumedGrants: z
        .array(activeRuleEffectRecordSchema)
        .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
      forcedMovements: liveSessionForcedMovementsSchema,
      ...liveSessionEncounterConcentrationFields()
    })
  )
