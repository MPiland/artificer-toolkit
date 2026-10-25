import { z, lazySchema } from '../zod.js'

import { initiativeCadenceDtoSchema, initiativeProcedureDtoSchema } from './initiativePolicy.js'
import { postgresUuidSchema } from './postgresUuid.js'

const serverUuidIdentityDtoSchema = lazySchema(() =>
  z.pipe(
    postgresUuidSchema,
    z.transform((value) => value.toLowerCase())
  )
)

const checksumSchema = lazySchema(() => z.string().check(z.regex(/^[a-f0-9]{64}$/)))
const versionSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
const positiveRoundSchema = lazySchema(() => z.number().check(z.int()).check(z.positive()))
const ordinalSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
const initiativeScoreSchema = lazySchema(() => z.nullable(z.number()))

const initiativeDeclarationSourceDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CHARACTER_ACTION'),
      optionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      effectId: serverUuidIdentityDtoSchema,
      sourceId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      sourceChecksum: checksumSchema,
      activationCode: z.nullable(
        z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
      ),
      equipmentInstanceId: z.nullable(
        z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
      ),
      equipmentProperties: z
        .array(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)))
        .check(z.maxLength(64))
    }),
    z.strictObject({
      kind: z.literal('CHARACTER_SPELL_CAST'),
      optionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000)),
      spellId: serverUuidIdentityDtoSchema,
      spellVersionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      spellVersion: z.number().check(z.int()).check(z.positive()),
      spellChecksum: checksumSchema,
      sourceKind: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
      sourceInstanceId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      castLevel: z.number().check(z.int()).check(z.gte(0)).check(z.lte(99))
    }),
    z.strictObject({
      kind: z.literal('CREATURE_FEATURE_ACTION'),
      optionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      actorId: serverUuidIdentityDtoSchema,
      creatureSourceId: serverUuidIdentityDtoSchema,
      sourceRevision: z.number().check(z.int()).check(z.positive()),
      sourceVersionId: serverUuidIdentityDtoSchema,
      sourceChecksum: checksumSchema,
      ownerFeatureId: serverUuidIdentityDtoSchema,
      featureOptionId: z.nullable(serverUuidIdentityDtoSchema),
      effectId: serverUuidIdentityDtoSchema,
      compiledEffectChecksum: checksumSchema,
      activationCode: z.nullable(
        z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
      ),
      featureResourceUse: z.nullable(
        z.strictObject({
          chargeId: serverUuidIdentityDtoSchema,
          cost: z.number().check(z.int()).check(z.positive())
        })
      )
    }),
    z.strictObject({
      kind: z.literal('GM_ADJUDICATED'),
      optionId: z.literal('GM_ADJUDICATED'),
      actorId: serverUuidIdentityDtoSchema,
      /** Factor IDs from the frozen policy's `declarationModifiers`. */
      factorIds: z
        .array(serverUuidIdentityDtoSchema)
        .check(z.maxLength(32))
        .check(
          z.superRefine((value, context) => {
            if (new Set(value).size !== value.length) {
              context.addIssue({
                code: 'custom',
                message: 'GM-adjudicated initiative factors must be unique.'
              })
            }
          })
        ),
      spellLevel: z.nullable(z.number().check(z.int()).check(z.gte(0)).check(z.lte(99)))
    })
  ])
)

export const initiativeDeclarationFactsDtoSchema = lazySchema(() =>
  z
    .strictObject({
      actorSize: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
      primary: initiativeDeclarationSourceDtoSchema,
      bonus: z.nullable(initiativeDeclarationSourceDtoSchema)
    })
    .check(
      z.superRefine((value, context) => {
        if (
          value.bonus &&
          value.bonus.kind === value.primary.kind &&
          value.bonus.optionId === value.primary.optionId
        ) {
          context.addIssue({
            code: 'custom',
            path: ['bonus'],
            message: 'The declared bonus source must differ from the primary source.'
          })
        }
      })
    )
)

export const initiativeRoundProcedureDtoSchema = lazySchema(() =>
  z.union([initiativeProcedureDtoSchema, z.literal('MANUAL')])
)
export const initiativeRoundStatusDtoSchema = lazySchema(() =>
  z.enum(['PREPARING', 'ACTIVE', 'COMPLETED'])
)
export const initiativeParticipantStatusDtoSchema = lazySchema(() =>
  z.enum(['UNRESOLVED', 'PENDING', 'EVALUATED', 'READY', 'ACTIVE', 'ACTED'])
)
export const initiativeSideStatusDtoSchema = lazySchema(() =>
  z.enum(['UNRESOLVED', 'PENDING', 'EVALUATED', 'READY', 'ACTIVE', 'COMPLETED'])
)

export const initiativeOccurrenceResultPointerDtoSchema = lazySchema(() =>
  z.strictObject({
    occurrenceId: serverUuidIdentityDtoSchema,
    resultChecksum: checksumSchema
  })
)

export const encounterInitiativeRoundDtoSchema = lazySchema(() =>
  z
    .strictObject({
      encounterId: serverUuidIdentityDtoSchema,
      round: positiveRoundSchema,
      procedure: initiativeRoundProcedureDtoSchema,
      cadence: initiativeCadenceDtoSchema,
      status: initiativeRoundStatusDtoSchema,
      policySnapshotChecksum: z.nullable(checksumSchema),
      nextTurnOrderOrdinal: ordinalSchema,
      version: versionSchema,
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime()
    })
    .check(
      z.superRefine((value, context) => {
        const shouldHavePolicyChecksum = value.procedure !== 'MANUAL'
        if (shouldHavePolicyChecksum !== (value.policySnapshotChecksum !== null)) {
          context.addIssue({
            code: 'custom',
            path: ['policySnapshotChecksum'],
            message: 'Only MANUAL initiative rounds may omit their policy snapshot checksum.'
          })
        }
      })
    )
)

function validateOccurrencePointer(
  value: { occurrenceId: string | null; resultChecksum: string | null },
  context: z.core.$RefinementCtx,
  field: 'evaluation' | 'tie'
): void {
  if ((value.occurrenceId === null) !== (value.resultChecksum === null)) {
    context.addIssue({
      code: 'custom',
      path: [field],
      message: `${field} occurrence identity and result checksum must be stored together.`
    })
  }
}

const initiativeOccurrencePointerFieldsSchema = lazySchema(() =>
  z.strictObject({
    occurrenceId: z.nullable(serverUuidIdentityDtoSchema),
    resultChecksum: z.nullable(checksumSchema)
  })
)

export const encounterInitiativeParticipantDtoSchema = lazySchema(() =>
  z
    .strictObject({
      encounterId: serverUuidIdentityDtoSchema,
      round: positiveRoundSchema,
      actorId: serverUuidIdentityDtoSchema,
      sideId: serverUuidIdentityDtoSchema,
      status: initiativeParticipantStatusDtoSchema,
      initiativeScore: initiativeScoreSchema,
      evaluation: initiativeOccurrencePointerFieldsSchema,
      tie: initiativeOccurrencePointerFieldsSchema,
      declaration: z.nullable(initiativeDeclarationFactsDtoSchema),
      declarationChecksum: z.nullable(checksumSchema),
      turnOrderOrdinal: z.nullable(ordinalSchema),
      version: versionSchema,
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime()
    })
    .check(
      z.superRefine((value, context) => {
        validateOccurrencePointer(value.evaluation, context, 'evaluation')
        validateOccurrencePointer(value.tie, context, 'tie')
        if ((value.declaration == null) !== (value.declarationChecksum == null)) {
          context.addIssue({
            code: 'custom',
            path: ['declaration'],
            message: 'Initiative declaration facts and checksum must be stored together.'
          })
        }
        const needsTurnOrder = ['READY', 'ACTIVE', 'ACTED'].includes(value.status)
        if (needsTurnOrder !== (value.turnOrderOrdinal !== null)) {
          context.addIssue({
            code: 'custom',
            path: ['turnOrderOrdinal'],
            message: 'Turn order is required exactly for ready, active, and acted participants.'
          })
        }
      })
    )
)

export const encounterInitiativeSideDtoSchema = lazySchema(() =>
  z
    .strictObject({
      encounterId: serverUuidIdentityDtoSchema,
      round: positiveRoundSchema,
      sideId: serverUuidIdentityDtoSchema,
      status: initiativeSideStatusDtoSchema,
      initiativeScore: initiativeScoreSchema,
      evaluation: initiativeOccurrencePointerFieldsSchema,
      tie: initiativeOccurrencePointerFieldsSchema,
      sideOrderOrdinal: z.nullable(ordinalSchema),
      version: versionSchema,
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime()
    })
    .check(
      z.superRefine((value, context) => {
        validateOccurrencePointer(value.evaluation, context, 'evaluation')
        validateOccurrencePointer(value.tie, context, 'tie')
        const needsSideOrder = ['READY', 'ACTIVE', 'COMPLETED'].includes(value.status)
        if (needsSideOrder !== (value.sideOrderOrdinal !== null)) {
          context.addIssue({
            code: 'custom',
            path: ['sideOrderOrdinal'],
            message: 'Side order is required exactly for ready, active, and completed sides.'
          })
        }
      })
    )
)

const encounterInitiativeRoundStateBaseDtoSchema = lazySchema(() =>
  z.strictObject({
    round: encounterInitiativeRoundDtoSchema,
    sides: z.array(encounterInitiativeSideDtoSchema),
    participants: z.array(encounterInitiativeParticipantDtoSchema)
  })
)

function validateEncounterInitiativeRoundState(
  value: z.infer<typeof encounterInitiativeRoundStateBaseDtoSchema>,
  context: z.core.$RefinementCtx
) {
  for (const [index, side] of value.sides.entries()) {
    if (side.encounterId !== value.round.encounterId || side.round !== value.round.round) {
      context.addIssue({
        code: 'custom',
        path: ['sides', index],
        message: 'Initiative side state must belong to the enclosing Encounter round.'
      })
    }
    if (index > 0 && value.sides[index - 1]!.sideId >= side.sideId) {
      context.addIssue({
        code: 'custom',
        path: ['sides', index, 'sideId'],
        message: 'Initiative side state must use unique ascending side identity order.'
      })
    }
  }

  for (const [index, participant] of value.participants.entries()) {
    if (
      participant.encounterId !== value.round.encounterId ||
      participant.round !== value.round.round
    ) {
      context.addIssue({
        code: 'custom',
        path: ['participants', index],
        message: 'Initiative participant state must belong to the enclosing Encounter round.'
      })
    }
    if (index > 0 && value.participants[index - 1]!.actorId >= participant.actorId) {
      context.addIssue({
        code: 'custom',
        path: ['participants', index, 'actorId'],
        message: 'Initiative participant state must use unique ascending actor identity order.'
      })
    }
  }

  if (value.round.procedure !== 'SIDE_ROLL' && value.sides.length > 0) {
    context.addIssue({
      code: 'custom',
      path: ['sides'],
      message: 'Only SIDE_ROLL initiative rounds may contain normalized side state.'
    })
  }
}

export const encounterInitiativeRoundStateDtoSchema = lazySchema(() =>
  encounterInitiativeRoundStateBaseDtoSchema.check(
    z.superRefine(validateEncounterInitiativeRoundState)
  )
)

type StagedInitiativeRoundState = {
  round: Omit<z.infer<typeof encounterInitiativeRoundDtoSchema>, 'createdAt' | 'updatedAt'>
  sides: Array<Omit<z.infer<typeof encounterInitiativeSideDtoSchema>, 'createdAt' | 'updatedAt'>>
  participants: Array<
    Omit<z.infer<typeof encounterInitiativeParticipantDtoSchema>, 'createdAt' | 'updatedAt'>
  >
}

/**
 * A paused occurrence stores the canonical initiative rows without audit timestamps.
 * Validation hydrates fixed server-only placeholders and delegates every invariant to
 * the one persisted round/participant/side state contract above.
 */
export const stagedInitiativeRoundStateDtoSchema: z.ZodMiniType<StagedInitiativeRoundState> =
  lazySchema(() =>
    z.pipe(
      z.pipe(
        z.transform((value) => {
          if (!value || typeof value !== 'object' || Array.isArray(value)) return value
          const state = value as {
            round?: Record<string, unknown>
            sides?: readonly Record<string, unknown>[]
            participants?: readonly Record<string, unknown>[]
          }
          const timestamp = '1970-01-01T00:00:00.000Z'
          return {
            ...state,
            round: state.round
              ? { ...state.round, createdAt: timestamp, updatedAt: timestamp }
              : state.round,
            sides: state.sides?.map((side) => ({
              ...side,
              createdAt: timestamp,
              updatedAt: timestamp
            })),
            participants: state.participants?.map((participant) => ({
              ...participant,
              createdAt: timestamp,
              updatedAt: timestamp
            }))
          }
        }),
        encounterInitiativeRoundStateDtoSchema
      ),
      z.transform((state) => ({
        round: (({ createdAt: _createdAt, updatedAt: _updatedAt, ...round }) => round)(state.round),
        sides: state.sides.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...side }) => side),
        participants: state.participants.map(
          ({ createdAt: _createdAt, updatedAt: _updatedAt, ...participant }) => participant
        )
      }))
    )
  )

export const createEncounterInitiativeRoundDtoSchema = lazySchema(() =>
  z
    .strictObject({
      encounterId: serverUuidIdentityDtoSchema,
      round: positiveRoundSchema,
      procedure: initiativeRoundProcedureDtoSchema,
      cadence: initiativeCadenceDtoSchema,
      policySnapshotChecksum: z.nullable(checksumSchema)
    })
    .check(
      z.superRefine((value, context) => {
        const requiresPolicyChecksum = value.procedure !== 'MANUAL'
        if (requiresPolicyChecksum !== (value.policySnapshotChecksum !== null)) {
          context.addIssue({
            code: 'custom',
            path: ['policySnapshotChecksum'],
            message: 'Only a MANUAL initiative round may omit its sealed policy checksum.'
          })
        }
      })
    )
)

export const updateEncounterInitiativeRoundDtoSchema = lazySchema(() =>
  z.strictObject({
    encounterId: serverUuidIdentityDtoSchema,
    round: positiveRoundSchema,
    expectedVersion: versionSchema,
    status: initiativeRoundStatusDtoSchema,
    nextTurnOrderOrdinal: ordinalSchema
  })
)

export const updateEncounterInitiativeParticipantDtoSchema = lazySchema(() =>
  z
    .strictObject({
      encounterId: serverUuidIdentityDtoSchema,
      round: positiveRoundSchema,
      actorId: serverUuidIdentityDtoSchema,
      expectedVersion: versionSchema,
      status: initiativeParticipantStatusDtoSchema,
      initiativeScore: initiativeScoreSchema,
      evaluation: initiativeOccurrencePointerFieldsSchema,
      tie: initiativeOccurrencePointerFieldsSchema,
      declaration: z.nullable(initiativeDeclarationFactsDtoSchema),
      declarationChecksum: z.nullable(checksumSchema),
      turnOrderOrdinal: z.nullable(ordinalSchema)
    })
    .check(
      z.superRefine((value, context) => {
        validateOccurrencePointer(value.evaluation, context, 'evaluation')
        validateOccurrencePointer(value.tie, context, 'tie')
        if ((value.declaration == null) !== (value.declarationChecksum == null)) {
          context.addIssue({
            code: 'custom',
            path: ['declaration'],
            message: 'Initiative declaration facts and checksum must be stored together.'
          })
        }
        const needsTurnOrder = ['READY', 'ACTIVE', 'ACTED'].includes(value.status)
        if (needsTurnOrder !== (value.turnOrderOrdinal !== null)) {
          context.addIssue({
            code: 'custom',
            path: ['turnOrderOrdinal'],
            message: 'Turn order is required exactly for ready, active, and acted participants.'
          })
        }
      })
    )
)

export const updateEncounterInitiativeSideDtoSchema = lazySchema(() =>
  z
    .strictObject({
      encounterId: serverUuidIdentityDtoSchema,
      round: positiveRoundSchema,
      sideId: serverUuidIdentityDtoSchema,
      expectedVersion: versionSchema,
      status: initiativeSideStatusDtoSchema,
      initiativeScore: initiativeScoreSchema,
      evaluation: initiativeOccurrencePointerFieldsSchema,
      tie: initiativeOccurrencePointerFieldsSchema,
      sideOrderOrdinal: z.nullable(ordinalSchema)
    })
    .check(
      z.superRefine((value, context) => {
        validateOccurrencePointer(value.evaluation, context, 'evaluation')
        validateOccurrencePointer(value.tie, context, 'tie')
        const needsSideOrder = ['READY', 'ACTIVE', 'COMPLETED'].includes(value.status)
        if (needsSideOrder !== (value.sideOrderOrdinal !== null)) {
          context.addIssue({
            code: 'custom',
            path: ['sideOrderOrdinal'],
            message: 'Side order is required exactly for ready, active, and completed sides.'
          })
        }
      })
    )
)

export type InitiativeRoundProcedureDto = z.infer<typeof initiativeRoundProcedureDtoSchema>
export type InitiativeRoundStatusDto = z.infer<typeof initiativeRoundStatusDtoSchema>
export type InitiativeParticipantStatusDto = z.infer<typeof initiativeParticipantStatusDtoSchema>
export type InitiativeSideStatusDto = z.infer<typeof initiativeSideStatusDtoSchema>
export type InitiativeOccurrenceResultPointerDto = z.infer<
  typeof initiativeOccurrenceResultPointerDtoSchema
>
export type InitiativeDeclarationFactsDto = z.infer<typeof initiativeDeclarationFactsDtoSchema>
export type EncounterInitiativeRoundDto = z.infer<typeof encounterInitiativeRoundDtoSchema>
export type EncounterInitiativeParticipantDto = z.infer<
  typeof encounterInitiativeParticipantDtoSchema
>
export type EncounterInitiativeSideDto = z.infer<typeof encounterInitiativeSideDtoSchema>
export type EncounterInitiativeRoundStateDto = z.infer<
  typeof encounterInitiativeRoundStateDtoSchema
>
export type PausedInitiativeRoundStateDto = z.infer<typeof stagedInitiativeRoundStateDtoSchema>
export type CreateEncounterInitiativeRoundDto = z.infer<
  typeof createEncounterInitiativeRoundDtoSchema
>
export type UpdateEncounterInitiativeRoundDto = z.infer<
  typeof updateEncounterInitiativeRoundDtoSchema
>
export type UpdateEncounterInitiativeParticipantDto = z.infer<
  typeof updateEncounterInitiativeParticipantDtoSchema
>
export type UpdateEncounterInitiativeSideDto = z.infer<
  typeof updateEncounterInitiativeSideDtoSchema
>
