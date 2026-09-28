import { z, lazySchema } from '../zod.js'
import { encounterGmActorDtoSchema, encounterGmProjectionDtoSchema } from '../api/encounterData.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { encounterInitiativePolicySnapshotDtoSchema } from '../shared/initiativePolicySnapshot.js'
import { encounterOptionalCombatSnapshotDtoSchema } from '../shared/optionalCombat.js'
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
      defeated: true
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
 * A Character actor keeps no hit point, condition or stream-version copy while the Run reads its
 * Character: Encounter reads load the current Character (ADR 0034 decision 4). Creature and custom
 * actors own that state in the Run.
 */
export const encounterRunActorStateSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.extend(encounterRunActorStateBaseSchema, {
      kind: z.literal('CHARACTER'),
      sourceId: postgresUuidSchema,
      /**
       * The Character's projected health and conditions when the Run stopped reading it: when the
       * Run completed, or when the Character left the Campaign while the Run was open. Null while
       * the Run reads the current Character.
       */
      frozenState: z.nullable(
        z.strictObject({
          currentHitPoints: z.number().check(z.int()).check(z.nonnegative()),
          maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
          tempHitPoints: z.number().check(z.int()).check(z.nonnegative()),
          conditions: jsonValueSchema
        })
      )
    }),
    z.extend(encounterRunActorStateBaseSchema, {
      kind: z.enum(['CREATURE', 'CUSTOM']),
      sourceId: z.nullable(postgresUuidSchema),
      sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
      currentHitPoints: z.number().check(z.int()).check(z.nonnegative()),
      maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
      tempHitPoints: z.number().check(z.int()).check(z.nonnegative()),
      conditions: jsonValueSchema,
      /** Set in the commit whose damage reduces the actor to 0 hit points; cleared by regaining any. */
      defeated: z.boolean()
    })
  ])
)

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
