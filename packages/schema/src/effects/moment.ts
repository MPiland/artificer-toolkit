import { z } from 'zod'

import { conditionDtoSchema } from './condition.js'
import { damageDtoSchema } from './damage.js'
import { durationDtoSchema } from '../shared/duration.js'
import {
  momentCodeSchema,
  momentGroupTypeSchema,
  momentResolutionKindSchema,
  momentRollTableKindSchema
} from '../shared/enums.js'

const momentEffectPayloadDtoSchema = z.union([
  damageDtoSchema,
  conditionDtoSchema
])

const momentDirectDtoSchema = z.object({
  resolutionKind: z.literal(momentResolutionKindSchema.enum.DIRECT),
  duration: durationDtoSchema.optional()
}).and(momentEffectPayloadDtoSchema)

const exactRollTableEntryDtoSchema = z.object({
  id: z.string(),
  rollValue: z.number(),
  duration: durationDtoSchema.optional(),
  description: z.string().optional()
}).and(momentEffectPayloadDtoSchema)

const rangeRollTableEntryDtoSchema = z.object({
  id: z.string(),
  rollRange: z.tuple([z.number(), z.number()]),
  duration: durationDtoSchema.optional(),
  description: z.string().optional()
}).and(momentEffectPayloadDtoSchema)

const momentRollTableDtoSchema = z.union([
  z.object({
    resolutionKind: z.literal(momentResolutionKindSchema.enum.ROLL_TABLE),
    rollTableKind: z.literal(momentRollTableKindSchema.enum.EXACT),
    table: z.array(exactRollTableEntryDtoSchema),
    dieConfig: z.string()
  }),
  z.object({
    resolutionKind: z.literal(momentResolutionKindSchema.enum.ROLL_TABLE),
    rollTableKind: z.literal(momentRollTableKindSchema.enum.RANGE),
    table: z.array(rangeRollTableEntryDtoSchema),
    dieConfig: z.string()
  })
])

export const momentDtoSchema = z.object({
  id: z.string(),
  moment: momentCodeSchema,
  groupType: momentGroupTypeSchema
}).and(z.union([momentDirectDtoSchema, momentRollTableDtoSchema]))

export type MomentDto = z.infer<typeof momentDtoSchema>
