import { z } from 'zod'

import { initiativeCadenceDtoSchema, initiativeProcedureDtoSchema } from './initiativePolicy.js'
import { postgresUuidSchema } from './postgresUuid.js'

const serverUuidIdentityDtoSchema = postgresUuidSchema.transform((value) => value.toLowerCase())

const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/)
const versionSchema = z.number().int().nonnegative()
const positiveRoundSchema = z.number().int().positive()
const ordinalSchema = z.number().int().nonnegative()
const initiativeScoreSchema = z.number().finite().nullable()

const initiativeDeclarationSourceDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('CHARACTER_ACTION'),
    optionId: z.string().trim().min(1).max(240),
    effectId: serverUuidIdentityDtoSchema,
    sourceId: z.string().trim().min(1).max(240),
    sourceChecksum: checksumSchema,
    activationCode: z.string().trim().min(1).max(240).nullable(),
    equipmentInstanceId: z.string().trim().min(1).max(240).nullable(),
    equipmentProperties: z.array(z.string().trim().min(1).max(240)).max(64)
  }),
  z.strictObject({
    kind: z.literal('CHARACTER_SPELL_CAST'),
    optionId: z.string().trim().min(1).max(1_000),
    spellId: serverUuidIdentityDtoSchema,
    spellVersionId: z.string().trim().min(1).max(240),
    spellVersion: z.number().int().positive(),
    spellChecksum: checksumSchema,
    sourceKind: z.string().trim().min(1).max(80),
    sourceInstanceId: z.string().trim().min(1).max(240),
    castLevel: z.number().int().min(0).max(99)
  }),
  z.strictObject({
    kind: z.literal('CREATURE_FEATURE_ACTION'),
    optionId: z.string().trim().min(1).max(240),
    actorId: serverUuidIdentityDtoSchema,
    creatureSourceId: serverUuidIdentityDtoSchema,
    sourceRevision: z.number().int().positive(),
    sourceVersionId: serverUuidIdentityDtoSchema,
    sourceChecksum: checksumSchema,
    ownerFeatureId: serverUuidIdentityDtoSchema,
    featureOptionId: serverUuidIdentityDtoSchema.nullable(),
    effectId: serverUuidIdentityDtoSchema,
    compiledEffectChecksum: checksumSchema,
    activationCode: z.string().trim().min(1).max(240).nullable(),
    featureResourceUse: z
      .strictObject({
        chargeId: serverUuidIdentityDtoSchema,
        cost: z.number().int().positive()
      })
      .nullable()
  }),
  z.strictObject({
    kind: z.literal('GM_ADJUDICATED'),
    optionId: z.literal('GM_ADJUDICATED'),
    actorId: serverUuidIdentityDtoSchema,
    actionFactors: z
      .array(
        z.enum(['MELEE_HEAVY', 'MELEE_LIGHT_OR_FINESSE', 'MELEE_TWO_HANDED', 'RANGED_LOADING'])
      )
      .max(4)
      .superRefine((value, context) => {
        if (new Set(value).size !== value.length) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'GM-adjudicated Speed Factor selections must be unique.'
          })
        }
      }),
    spellLevel: z.number().int().min(0).max(99).nullable()
  })
])

export const initiativeDeclarationFactsDtoSchema = z
  .strictObject({
    actorSize: z.string().trim().min(1).max(80),
    primary: initiativeDeclarationSourceDtoSchema,
    bonus: initiativeDeclarationSourceDtoSchema.nullable()
  })
  .superRefine((value, context) => {
    if (
      value.bonus &&
      value.bonus.kind === value.primary.kind &&
      value.bonus.optionId === value.primary.optionId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bonus'],
        message: 'The declared bonus source must differ from the primary source.'
      })
    }
  })

export const initiativeRoundProcedureDtoSchema = z.union([
  initiativeProcedureDtoSchema,
  z.literal('MANUAL')
])
export const initiativeRoundStatusDtoSchema = z.enum(['PREPARING', 'ACTIVE', 'COMPLETED'])
export const initiativeParticipantStatusDtoSchema = z.enum([
  'UNRESOLVED',
  'PENDING',
  'EVALUATED',
  'READY',
  'ACTIVE',
  'ACTED'
])
export const initiativeSideStatusDtoSchema = z.enum([
  'UNRESOLVED',
  'PENDING',
  'EVALUATED',
  'READY',
  'ACTIVE',
  'COMPLETED'
])

export const initiativeOccurrenceResultPointerDtoSchema = z.strictObject({
  occurrenceId: serverUuidIdentityDtoSchema,
  resultChecksum: checksumSchema
})

export const encounterInitiativeRoundDtoSchema = z
  .strictObject({
    encounterId: serverUuidIdentityDtoSchema,
    round: positiveRoundSchema,
    procedure: initiativeRoundProcedureDtoSchema,
    cadence: initiativeCadenceDtoSchema,
    status: initiativeRoundStatusDtoSchema,
    policySnapshotChecksum: checksumSchema.nullable(),
    nextTurnOrderOrdinal: ordinalSchema,
    version: versionSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .superRefine((value, context) => {
    const shouldHavePolicyChecksum = value.procedure !== 'MANUAL'
    if (shouldHavePolicyChecksum !== (value.policySnapshotChecksum !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['policySnapshotChecksum'],
        message: 'Only MANUAL initiative rounds may omit their policy snapshot checksum.'
      })
    }
  })

function validateOccurrencePointer(
  value: { occurrenceId: string | null; resultChecksum: string | null },
  context: z.RefinementCtx,
  field: 'evaluation' | 'tie'
): void {
  if ((value.occurrenceId === null) !== (value.resultChecksum === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
      message: `${field} occurrence identity and result checksum must be stored together.`
    })
  }
}

const initiativeOccurrencePointerFieldsSchema = z.strictObject({
  occurrenceId: serverUuidIdentityDtoSchema.nullable(),
  resultChecksum: checksumSchema.nullable()
})

export const encounterInitiativeParticipantDtoSchema = z
  .strictObject({
    encounterId: serverUuidIdentityDtoSchema,
    round: positiveRoundSchema,
    actorId: serverUuidIdentityDtoSchema,
    sideId: serverUuidIdentityDtoSchema,
    status: initiativeParticipantStatusDtoSchema,
    initiativeScore: initiativeScoreSchema,
    evaluation: initiativeOccurrencePointerFieldsSchema,
    tie: initiativeOccurrencePointerFieldsSchema,
    declaration: initiativeDeclarationFactsDtoSchema.nullable(),
    declarationChecksum: checksumSchema.nullable(),
    turnOrderOrdinal: ordinalSchema.nullable(),
    version: versionSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .superRefine((value, context) => {
    validateOccurrencePointer(value.evaluation, context, 'evaluation')
    validateOccurrencePointer(value.tie, context, 'tie')
    if ((value.declaration == null) !== (value.declarationChecksum == null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['declaration'],
        message: 'Initiative declaration facts and checksum must be stored together.'
      })
    }
    const needsTurnOrder = ['READY', 'ACTIVE', 'ACTED'].includes(value.status)
    if (needsTurnOrder !== (value.turnOrderOrdinal !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['turnOrderOrdinal'],
        message: 'Turn order is required exactly for ready, active, and acted participants.'
      })
    }
  })

export const encounterInitiativeSideDtoSchema = z
  .strictObject({
    encounterId: serverUuidIdentityDtoSchema,
    round: positiveRoundSchema,
    sideId: serverUuidIdentityDtoSchema,
    status: initiativeSideStatusDtoSchema,
    initiativeScore: initiativeScoreSchema,
    evaluation: initiativeOccurrencePointerFieldsSchema,
    tie: initiativeOccurrencePointerFieldsSchema,
    sideOrderOrdinal: ordinalSchema.nullable(),
    version: versionSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .superRefine((value, context) => {
    validateOccurrencePointer(value.evaluation, context, 'evaluation')
    validateOccurrencePointer(value.tie, context, 'tie')
    const needsSideOrder = ['READY', 'ACTIVE', 'COMPLETED'].includes(value.status)
    if (needsSideOrder !== (value.sideOrderOrdinal !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sideOrderOrdinal'],
        message: 'Side order is required exactly for ready, active, and completed sides.'
      })
    }
  })

const encounterInitiativeRoundStateBaseDtoSchema = z.strictObject({
  round: encounterInitiativeRoundDtoSchema,
  sides: z.array(encounterInitiativeSideDtoSchema),
  participants: z.array(encounterInitiativeParticipantDtoSchema)
})

function validateEncounterInitiativeRoundState(
  value: z.infer<typeof encounterInitiativeRoundStateBaseDtoSchema>,
  context: z.RefinementCtx
) {
  for (const [index, side] of value.sides.entries()) {
    if (side.encounterId !== value.round.encounterId || side.round !== value.round.round) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sides', index],
        message: 'Initiative side state must belong to the enclosing Encounter round.'
      })
    }
    if (index > 0 && value.sides[index - 1]!.sideId >= side.sideId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
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
        code: z.ZodIssueCode.custom,
        path: ['participants', index],
        message: 'Initiative participant state must belong to the enclosing Encounter round.'
      })
    }
    if (index > 0 && value.participants[index - 1]!.actorId >= participant.actorId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['participants', index, 'actorId'],
        message: 'Initiative participant state must use unique ascending actor identity order.'
      })
    }
  }

  if (value.round.procedure !== 'SIDE_ROLL' && value.sides.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sides'],
      message: 'Only SIDE_ROLL initiative rounds may contain normalized side state.'
    })
  }
}

export const encounterInitiativeRoundStateDtoSchema =
  encounterInitiativeRoundStateBaseDtoSchema.superRefine(validateEncounterInitiativeRoundState)

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
export const stagedInitiativeRoundStateDtoSchema: z.ZodType<StagedInitiativeRoundState> = z
  .preprocess((value) => {
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
      sides: state.sides?.map((side) => ({ ...side, createdAt: timestamp, updatedAt: timestamp })),
      participants: state.participants?.map((participant) => ({
        ...participant,
        createdAt: timestamp,
        updatedAt: timestamp
      }))
    }
  }, encounterInitiativeRoundStateDtoSchema)
  .transform((state) => ({
    round: (({ createdAt: _createdAt, updatedAt: _updatedAt, ...round }) => round)(state.round),
    sides: state.sides.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...side }) => side),
    participants: state.participants.map(
      ({ createdAt: _createdAt, updatedAt: _updatedAt, ...participant }) => participant
    )
  }))

export const createEncounterInitiativeRoundDtoSchema = z
  .strictObject({
    encounterId: serverUuidIdentityDtoSchema,
    round: positiveRoundSchema,
    procedure: initiativeRoundProcedureDtoSchema,
    cadence: initiativeCadenceDtoSchema,
    policySnapshotChecksum: checksumSchema.nullable()
  })
  .superRefine((value, context) => {
    const requiresPolicyChecksum = value.procedure !== 'MANUAL'
    if (requiresPolicyChecksum !== (value.policySnapshotChecksum !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['policySnapshotChecksum'],
        message: 'Only a MANUAL initiative round may omit its sealed policy checksum.'
      })
    }
  })

export const updateEncounterInitiativeRoundDtoSchema = z.strictObject({
  encounterId: serverUuidIdentityDtoSchema,
  round: positiveRoundSchema,
  expectedVersion: versionSchema,
  status: initiativeRoundStatusDtoSchema,
  nextTurnOrderOrdinal: ordinalSchema
})

export const updateEncounterInitiativeParticipantDtoSchema = z
  .strictObject({
    encounterId: serverUuidIdentityDtoSchema,
    round: positiveRoundSchema,
    actorId: serverUuidIdentityDtoSchema,
    expectedVersion: versionSchema,
    status: initiativeParticipantStatusDtoSchema,
    initiativeScore: initiativeScoreSchema,
    evaluation: initiativeOccurrencePointerFieldsSchema,
    tie: initiativeOccurrencePointerFieldsSchema,
    declaration: initiativeDeclarationFactsDtoSchema.nullable(),
    declarationChecksum: checksumSchema.nullable(),
    turnOrderOrdinal: ordinalSchema.nullable()
  })
  .superRefine((value, context) => {
    validateOccurrencePointer(value.evaluation, context, 'evaluation')
    validateOccurrencePointer(value.tie, context, 'tie')
    if ((value.declaration == null) !== (value.declarationChecksum == null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['declaration'],
        message: 'Initiative declaration facts and checksum must be stored together.'
      })
    }
    const needsTurnOrder = ['READY', 'ACTIVE', 'ACTED'].includes(value.status)
    if (needsTurnOrder !== (value.turnOrderOrdinal !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['turnOrderOrdinal'],
        message: 'Turn order is required exactly for ready, active, and acted participants.'
      })
    }
  })

export const updateEncounterInitiativeSideDtoSchema = z
  .strictObject({
    encounterId: serverUuidIdentityDtoSchema,
    round: positiveRoundSchema,
    sideId: serverUuidIdentityDtoSchema,
    expectedVersion: versionSchema,
    status: initiativeSideStatusDtoSchema,
    initiativeScore: initiativeScoreSchema,
    evaluation: initiativeOccurrencePointerFieldsSchema,
    tie: initiativeOccurrencePointerFieldsSchema,
    sideOrderOrdinal: ordinalSchema.nullable()
  })
  .superRefine((value, context) => {
    validateOccurrencePointer(value.evaluation, context, 'evaluation')
    validateOccurrencePointer(value.tie, context, 'tie')
    const needsSideOrder = ['READY', 'ACTIVE', 'COMPLETED'].includes(value.status)
    if (needsSideOrder !== (value.sideOrderOrdinal !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sideOrderOrdinal'],
        message: 'Side order is required exactly for ready, active, and completed sides.'
      })
    }
  })

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
