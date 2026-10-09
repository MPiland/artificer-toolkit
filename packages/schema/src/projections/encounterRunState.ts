import { z, lazySchema, lazySchemaParts } from '../zod.js'
import {
  encounterFeatureResourceDtoSchema,
  encounterGmActorDtoSchema,
  encounterGmProjectionDtoSchema
} from '../api/encounterData.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { encounterInitiativePolicySnapshotDtoSchema } from '../shared/initiativePolicySnapshot.js'
import { encounterOptionalCombatSnapshotDtoSchema } from '../shared/optionalCombat.js'
import { characterDeathSavesDtoSchema } from '../subjects/characterState.js'
import { jsonValueSchema, projectionChecksumSchema } from './identity.js'

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
      defeated: true,
      outOfInitiative: true
    }),
    {
      sideId: postgresUuidSchema,
      snapshot: jsonValueSchema,
      resources: jsonValueSchema,
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime()
    }
  )
)

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

/** Creature and custom actors own their health in the Run. */
const encounterRunActorHealthShape = lazySchemaParts(() => ({
  currentHitPoints: z.number().check(z.int()).check(z.nonnegative()),
  maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
  tempHitPoints: z.number().check(z.int()).check(z.nonnegative()),
  conditions: jsonValueSchema,
  /** Set in the commit whose damage reduces the actor to 0 hit points; cleared by regaining any. */
  defeated: z.boolean()
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
      outOfInitiative: z.boolean()
    }),
    z.extend(encounterRunActorStateBaseSchema, {
      kind: z.enum(['CREATURE', 'CUSTOM']),
      sourceId: z.nullable(postgresUuidSchema),
      sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
      ...encounterRunActorHealthShape()
    })
  ])
)

const encounterActorProjectionFactsBaseSchema = lazySchema(() =>
  z.omit(encounterRunActorStateBaseSchema, {
    sideId: true,
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
      outOfInitiative: z.boolean()
    }),
    z.extend(encounterActorProjectionFactsBaseSchema, {
      kind: z.enum(['CREATURE', 'CUSTOM']),
      sourceId: z.nullable(postgresUuidSchema),
      sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
      ...encounterRunActorHealthShape(),
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
      outOfInitiative: z.boolean()
    }),
    z.extend(encounterStoredRunActorStateBaseSchema, {
      kind: z.enum(['CREATURE', 'CUSTOM']),
      sourceId: z.nullable(postgresUuidSchema),
      sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
      ...encounterRunActorHealthShape(),
      ...encounterActorFeatureFactsShape()
    })
  ])
)

/** A Creature source's stat block and Feature references (without resources), as projected. */
export const encounterSourceProjectionFactsSchema = lazySchema(() =>
  z.pick(encounterGmActorDtoSchema, { statBlock: true, features: true })
)

export type EncounterActorProjectionFacts = z.infer<typeof encounterActorProjectionFactsSchema>
export type EncounterStoredRunActorState = z.infer<typeof encounterStoredRunActorStateSchema>
export type EncounterSourceProjectionFacts = z.infer<typeof encounterSourceProjectionFactsSchema>

export const encounterRunStateSchema = lazySchema(() =>
  z.extend(
    z.omit(encounterGmProjectionDtoSchema, {
      actors: true,
      initiativePolicy: true,
      optionalCombatRules: true
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
