import { z, lazySchema } from '../zod.js'

import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import { areaAimDtoSchema, type AreaAimDto } from './spatialFacts.js'

export type TurnResolutionCommandDto =
  | {
      kind:
        | 'ENTER_DICE'
        | 'SYSTEM_ROLL'
        | 'LEGENDARY_ENTER_DICE'
        | 'LEGENDARY_SYSTEM_ROLL'
        | 'ENTER_INTEGER'
        | 'INITIATIVE_SYSTEM_ROLL'
        | 'INITIATIVE_ENTITY'
        | 'INITIATIVE_DECLARATION'
      commandId: string
      commandFingerprint: string
      actorUserId: string
      correlationId: string | null
      expectedOccurrenceVersion: number
      requestId: string
      /** Present only for a persisted initiative declaration replay authority check. */
      initiativeActorId?: string | null
    }
  | {
      kind: 'LEGENDARY_DECLINE'
      commandId: string
      commandFingerprint: string
      actorUserId: string
      correlationId: string | null
      expectedOccurrenceVersion: number
      selectionChecksum: string
    }
  | {
      kind: 'LEGENDARY_OPTION'
      commandId: string
      commandFingerprint: string
      actorUserId: string
      correlationId: string | null
      expectedOccurrenceVersion: number
      selectionChecksum: string
      optionId: string
      targetActorId: string
      aim?: AreaAimDto
    }

export const turnResolutionCommandDtoSchema: z.ZodMiniType<TurnResolutionCommandDto> = lazySchema(
  () =>
    z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.enum([
          'ENTER_DICE',
          'SYSTEM_ROLL',
          'LEGENDARY_ENTER_DICE',
          'LEGENDARY_SYSTEM_ROLL',
          'ENTER_INTEGER',
          'INITIATIVE_SYSTEM_ROLL',
          'INITIATIVE_ENTITY',
          'INITIATIVE_DECLARATION'
        ]),
        commandId: uuidSchema,
        commandFingerprint: checksumSchema,
        actorUserId: uuidSchema,
        correlationId: z.nullable(uuidSchema),
        expectedOccurrenceVersion: integerSchema.check(z.gte(0)),
        requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
        initiativeActorId: z._default(z.nullable(uuidSchema), null)
      }),
      z.strictObject({
        kind: z.literal('LEGENDARY_DECLINE'),
        commandId: uuidSchema,
        commandFingerprint: checksumSchema,
        actorUserId: uuidSchema,
        correlationId: z.nullable(uuidSchema),
        expectedOccurrenceVersion: integerSchema.check(z.gte(0)),
        selectionChecksum: checksumSchema
      }),
      z.strictObject({
        kind: z.literal('LEGENDARY_OPTION'),
        commandId: uuidSchema,
        commandFingerprint: checksumSchema,
        actorUserId: uuidSchema,
        correlationId: z.nullable(uuidSchema),
        expectedOccurrenceVersion: integerSchema.check(z.gte(0)),
        selectionChecksum: checksumSchema,
        optionId: checksumSchema,
        targetActorId: uuidSchema,
        aim: z.optional(areaAimDtoSchema)
      })
    ])
)
