import { z, lazySchema, lazySchemaParts } from '../zod.js'
import {
  encounterFeatureResourceDtoSchema,
  encounterGmActorDtoSchema,
  encounterGmProjectionDtoSchema
} from '../api/encounterData.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from '../shared/spatial.js'
import { encounterInitiativePolicySnapshotDtoSchema } from '../shared/initiativePolicySnapshot.js'
import { encounterOptionalCombatSnapshotDtoSchema } from '../shared/optionalCombat.js'
import { encounterActorMoraleDtoSchema } from '../shared/encounterMorale.js'
import { encounterConsequenceRollOffersDtoSchema } from '../shared/consequenceRolls.js'
import { characterDeathSavesDtoSchema } from '../subjects/characterState.js'
import { jsonValueSchema, projectionChecksumSchema } from './identity.js'

/** One entry per damage type per command; a turn cycle never approaches this. */
const MAX_DAMAGE_TYPES_SINCE_TURN_START = 256

const encounterRunActorStateBaseSchema = lazySchema(() =>
  z.extend(
    z.omit(encounterGmActorDtoSchema, {
      statBlock: true,
      features: true,
      healthBand: true,
      kind: true,
      sourceId: true,
      sourceRevision: true,
      currentHitPoints: true,
      maxHitPoints: true,
      tempHitPoints: true,
      conditions: true,
      activeGrants: true,
      concentration: true,
      concealment: true,
      defeated: true,
      morale: true,
      moraleOffers: true,
      consequenceRollOffers: true
    }),
    {
      sideId: postgresUuidSchema,
      /** The actor's latest morale check (ENCOUNTER-6.2), absent when none was made. */
      morale: z.optional(encounterActorMoraleDtoSchema),
      /** The open consequence-table roll offers (ATTACK-15), absent when none. */
      consequenceRollOffers: z.optional(encounterConsequenceRollOffersDtoSchema),
      snapshot: jsonValueSchema,
      resources: jsonValueSchema,
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime()
    }
  )
)

/** Temporary hit points and the active effect that gave them, absent when none did (D156). */
const encounterTemporaryHitPointsShape = lazySchemaParts(() => ({
  tempHitPoints: z.number().check(z.int()).check(z.nonnegative()),
  tempHitPointsSourceEffectId: z.optional(postgresUuidSchema)
}))

/**
 * The Character's projected health and conditions when the Run stopped reading it: when the Run
 * completed, or when the Character left the Campaign while the Run was open. Null while the Run
 * reads the current Character.
 */
const encounterCharacterFrozenStateSchema = lazySchema(() =>
  z.nullable(
    z.strictObject({
      currentHitPoints: z.number().check(z.int()).check(z.nonnegative()),
      maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
      tempHitPoints: z.number().check(z.int()).check(z.nonnegative()),
      conditions: jsonValueSchema,
      /** A frozen Character at 0 HP with 3 failures stays dead (D96). */
      deathSaves: characterDeathSavesDtoSchema
    })
  )
)

/**
 * The creature an actor was before a shape-changing effect swapped in another Creature's snapshot
 * and hit points (D130), or null while it has its own form. The form's own hit points live in the
 * actor's `currentHitPoints`. The effect ending, the form dropping to 0 hit points, a dismissal and
 * a cast undo all restore the origin through the one revert (`revertActorForm`).
 */
const encounterActorFormShape = lazySchemaParts(() => ({
  /** The active effect that holds the form; it ending ends the form. */
  effectId: postgresUuidSchema,
  /** Whether damage past the form's last hit point reduces the origin's (Polymorph) or is lost (Giant Insect). */
  excessDamageCarriesOver: z.boolean()
}))

const encounterActorFormOriginShape = lazySchemaParts(() => ({
  sourceId: z.nullable(postgresUuidSchema),
  sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
  currentHitPoints: z.number().check(z.int()).check(z.nonnegative()),
  maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
  tempHitPoints: z.number().check(z.int()).check(z.nonnegative())
}))

/** A stored actor names its origin snapshot by checksum, like its own (`snapshotChecksum`). */
const encounterStoredActorFormSchema = lazySchema(() =>
  z.nullable(
    z.strictObject({
      ...encounterActorFormShape(),
      origin: z.strictObject({
        ...encounterActorFormOriginShape(),
        snapshotChecksum: projectionChecksumSchema
      })
    })
  )
)

/** The composed actor carries its origin snapshot, read only while the actor is in a form. */
const encounterRunActorFormSchema = lazySchema(() =>
  z.nullable(
    z.strictObject({
      ...encounterActorFormShape(),
      origin: z.strictObject({ ...encounterActorFormOriginShape(), snapshot: jsonValueSchema })
    })
  )
)

/**
 * The Creature form a Character actor has taken (D130 amendment, SPELLS-28.T4c), or null. The
 * Character's own state stays on the Sheet, untouched while the form lasts, so there is no origin:
 * the form's snapshot and hit points are the actor's own while `form` is set. Rare and at most one
 * per Character, so the snapshot is kept inline instead of shared by checksum.
 */
const encounterCharacterFormSchema = lazySchema(() =>
  z.nullable(
    z.strictObject({
      ...encounterActorFormShape(),
      sourceId: postgresUuidSchema,
      sourceRevision: z.number().check(z.int()).check(z.positive()),
      snapshot: jsonValueSchema,
      currentHitPoints: z.number().check(z.int()).check(z.nonnegative()),
      maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
      ...encounterTemporaryHitPointsShape()
    })
  )
)

/** Creature and custom actors own their health in the Run. */
const encounterRunActorHealthShape = lazySchemaParts(() => ({
  currentHitPoints: z.number().check(z.int()).check(z.nonnegative()),
  maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
  ...encounterTemporaryHitPointsShape(),
  conditions: jsonValueSchema,
  /** Set in the commit whose damage reduces the actor to 0 hit points; cleared by regaining any. */
  defeated: z.boolean(),
  /**
   * The damage this actor took since its last start-of-turn trigger, by type and the command that
   * dealt it; absent when none. The trigger's commit clears it, and undo removes or restores
   * entries by command id.
   */
  damageTypesSinceTurnStart: z.optional(
    z
      .array(z.strictObject({ damageTypeId: postgresUuidSchema, commandId: postgresUuidSchema }))
      .check(z.maxLength(MAX_DAMAGE_TYPES_SINCE_TURN_START))
  )
}))

/**
 * A Character actor keeps no hit point, condition or stream-version copy while the Run reads its
 * Character: Encounter reads load the current Character (ADR 0034 decision 4). Creature and custom
 * actors own that state in the Run.
 */
export const encounterRunActorStateSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.extend(encounterRunActorStateBaseSchema, {
      kind: z.literal('CHARACTER'),
      sourceId: postgresUuidSchema,
      frozenState: encounterCharacterFrozenStateSchema,
      form: encounterCharacterFormSchema
    }),
    z.extend(encounterRunActorStateBaseSchema, {
      kind: z.enum(['CREATURE', 'CUSTOM']),
      sourceId: z.nullable(postgresUuidSchema),
      sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
      ...encounterRunActorHealthShape(),
      form: encounterRunActorFormSchema
    })
  ])
)

const encounterActorProjectionFactsBaseSchema = lazySchema(() =>
  z.omit(encounterRunActorStateBaseSchema, {
    snapshot: true,
    createdAt: true,
    updatedAt: true
  })
)

/**
 * What a Creature or custom actor's projection shows beyond its state: the actor rules already
 * evaluated into each Feature's resource, and the checksum of the stat block and Feature references
 * its source shares with identical Creatures (`encounterSourceProjectionFactsSchema`).
 */
const encounterActorFeatureFactsShape = lazySchemaParts(() => ({
  sourceFactsChecksum: z.nullable(projectionChecksumSchema),
  /** The resource of each Feature that has one, by Feature ID. */
  featureResources: z.array(
    z.extend(encounterFeatureResourceDtoSchema, {
      featureId: z.string().check(z.minLength(1))
    })
  )
}))

/**
 * What a Run's projections show of one actor (ADR 0035 Amendment 12): the actor state without its
 * source snapshot, with the actor rules already evaluated into each Feature's resource. A Creature's
 * stat block and Feature references are shared by identical Creatures in the Run
 * (`encounterSourceProjectionFactsSchema`, by checksum). The Run stores these inside the actor's own
 * record (`encounterStoredRunActorStateSchema`), never as a second copy.
 */
export const encounterActorProjectionFactsSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.extend(encounterActorProjectionFactsBaseSchema, {
      kind: z.literal('CHARACTER'),
      sourceId: postgresUuidSchema,
      frozenState: encounterCharacterFrozenStateSchema,
      form: encounterCharacterFormSchema
    }),
    z.extend(encounterActorProjectionFactsBaseSchema, {
      kind: z.enum(['CREATURE', 'CUSTOM']),
      sourceId: z.nullable(postgresUuidSchema),
      sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
      ...encounterRunActorHealthShape(),
      form: encounterStoredActorFormSchema,
      ...encounterActorFeatureFactsShape()
    })
  ])
)

const encounterStoredRunActorStateBaseSchema = lazySchema(() =>
  z.extend(z.omit(encounterRunActorStateBaseSchema, { snapshot: true }), {
    /** The immutable source snapshot's checksum, in `encounterStoredActorSnapshotSchema`. */
    snapshotChecksum: projectionChecksumSchema
  })
)

/**
 * One actor's stored state (ADR 0035 Amendment 29): its mutable play state, the reference to its
 * source snapshot, which the Run stores once per distinct snapshot, and for a Creature or custom
 * actor the projection facts derived from both. The actor rules are evaluated when the actor is
 * written, so a projection reads this record alone. `composeRunActorState` restores the full
 * actor.
 */
export const encounterStoredRunActorStateSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.extend(encounterStoredRunActorStateBaseSchema, {
      kind: z.literal('CHARACTER'),
      sourceId: postgresUuidSchema,
      frozenState: encounterCharacterFrozenStateSchema,
      form: encounterCharacterFormSchema
    }),
    z.extend(encounterStoredRunActorStateBaseSchema, {
      kind: z.enum(['CREATURE', 'CUSTOM']),
      sourceId: z.nullable(postgresUuidSchema),
      sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
      ...encounterRunActorHealthShape(),
      form: encounterStoredActorFormSchema,
      ...encounterActorFeatureFactsShape()
    })
  ])
)

/** A Creature source's stat block and Feature references (without resources), as projected. */
export const encounterSourceProjectionFactsSchema = lazySchema(() =>
  z.pick(encounterGmActorDtoSchema, { statBlock: true, features: true })
)

export type EncounterActorForm = NonNullable<z.infer<typeof encounterRunActorFormSchema>>
export type EncounterCharacterForm = NonNullable<z.infer<typeof encounterCharacterFormSchema>>
export type EncounterActorProjectionFacts = z.infer<typeof encounterActorProjectionFactsSchema>
export type EncounterStoredRunActorState = z.infer<typeof encounterStoredRunActorStateSchema>
export type EncounterSourceProjectionFacts = z.infer<typeof encounterSourceProjectionFactsSchema>

export const encounterRunStateSchema = lazySchema(() =>
  z.extend(
    z.omit(encounterGmProjectionDtoSchema, {
      actors: true,
      initiativePolicy: true,
      optionalCombatRules: true,
      facingStepDegrees: true,
      facingArcs: true
    }),
    {
      actorIds: z.array(postgresUuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      initiativePolicySnapshot: z.nullable(encounterInitiativePolicySnapshotDtoSchema),
      initiativePolicySnapshotChecksum: z.nullable(projectionChecksumSchema),
      optionalCombatSnapshot: encounterOptionalCombatSnapshotDtoSchema,
      optionalCombatSnapshotChecksum: projectionChecksumSchema,
      /**
       * The turn's identity: it grows whenever a turn starts or the GM moves the turn to another actor
       * or round, so an effect scoped to one turn never revives when the turn returns to its actor.
       */
      turnSequence: z.number().check(z.int()).check(z.nonnegative()),
      /**
       * How often each zone has caught each creature this turn, keyed `effectId:actorId`. An entry
       * whose turn differs from `turnSequence` counts as unspent and is dropped on the next write.
       */
      zoneApplications: z.optional(
        z
          .record(
            z.string(),
            z.strictObject({
              turnSequence: z.number().check(z.int()).check(z.nonnegative()),
              count: z.number().check(z.int()).check(z.positive())
            })
          )
          .check(
            z.superRefine((applications, context) => {
              if (
                Object.keys(applications).length >
                MAX_ENCOUNTER_ACTORS * MAX_SPATIAL_RULE_EFFECTS_PER_SCENE
              )
                context.addIssue({
                  code: 'custom',
                  message: 'Zone applications exceed the actors and zones an Encounter holds.'
                })
            })
          )
      ),
      /**
       * Set while a turn's end waits on a delegated Legendary Action: the ADVANCE_TURN that selected
       * it, the option's owner and action, and the owners whose windows this turn end has settled.
       * The rule-raised action runs next, then a continuation ADVANCE_TURN offers the remaining
       * windows and starts the next turn.
       */
      delegatedLegendaryAction: z.optional(
        z.strictObject({
          parentCommandId: postgresUuidSchema,
          holderActorId: postgresUuidSchema,
          actionId: z.string().check(z.minLength(1)),
          settledOwnerActorIds: z
            .array(postgresUuidSchema)
            .check(z.minLength(1))
            .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
        })
      ),
      sides: z
        .array(
          z.strictObject({
            id: postgresUuidSchema,
            label: z.string(),
            sortOrder: z.number().check(z.int()).check(z.nonnegative())
          })
        )
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    }
  )
)

export type EncounterRunActorState = z.infer<typeof encounterRunActorStateSchema>
export type EncounterRunCharacterActorState = Extract<EncounterRunActorState, { kind: 'CHARACTER' }>
export type EncounterRunState = z.infer<typeof encounterRunStateSchema>
