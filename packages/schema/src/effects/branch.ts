import { z } from 'zod'

import { applyGrantDtoSchema } from './applyGrant.js'
import { conditionDtoSchema } from './condition.js'
import { damageDtoSchema } from './damage.js'
import { healDtoSchema } from './heal.js'
import { manifestDtoSchema } from './manifest.js'
import { ruleDtoSchema } from './rule.js'
import { teleportDtoSchema } from './teleport.js'
import { durationDtoSchema } from '../shared/duration.js'
import {
  branchCodeSchema,
  branchGroupTypeSchema,
  branchResolutionKindSchema,
  branchRollTableKindSchema
} from '../shared/enums.js'

const branchEffectPayloadDtoSchema = z.union([
  damageDtoSchema,
  conditionDtoSchema,
  healDtoSchema,
  applyGrantDtoSchema,
  teleportDtoSchema,
  manifestDtoSchema,
  ruleDtoSchema
])

const branchDirectDtoSchema = z.object({
  resolutionKind: z.literal(branchResolutionKindSchema.enum.DIRECT),
  duration: durationDtoSchema.optional()
}).and(branchEffectPayloadDtoSchema)

const exactRollTableEntryDtoSchema = z.object({
  id: z.string(),
  rollValue: z.number(),
  duration: durationDtoSchema.optional(),
  description: z.string().optional()
}).and(branchEffectPayloadDtoSchema)

const rangeRollTableEntryDtoSchema = z.object({
  id: z.string(),
  rollRange: z.tuple([z.number(), z.number()]),
  duration: durationDtoSchema.optional(),
  description: z.string().optional()
}).and(branchEffectPayloadDtoSchema)

const branchRollTableDtoSchema = z.union([
  z.object({
    resolutionKind: z.literal(branchResolutionKindSchema.enum.ROLL_TABLE),
    rollTableKind: z.literal(branchRollTableKindSchema.enum.EXACT),
    table: z.array(exactRollTableEntryDtoSchema),
    dieConfig: z.string()
  }),
  z.object({
    resolutionKind: z.literal(branchResolutionKindSchema.enum.ROLL_TABLE),
    rollTableKind: z.literal(branchRollTableKindSchema.enum.RANGE),
    table: z.array(rangeRollTableEntryDtoSchema),
    dieConfig: z.string()
  })
])

export const branchDtoSchema = z.object({
  id: z.string(),
  branch: branchCodeSchema,
  groupType: branchGroupTypeSchema
}).and(z.union([branchDirectDtoSchema, branchRollTableDtoSchema]))

export type BranchDto = z.infer<typeof branchDtoSchema>
