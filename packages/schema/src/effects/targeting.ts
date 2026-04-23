import { z } from 'zod'
import { createBreakpointScalingDtoSchema } from '../shared/scaling.js'

export const targetingDtoSchema = z.discriminatedUnion('selectionKind', [
  z.object({
    selectionKind: z.literal('SELF')
  }),
  z.object({
    selectionKind: z.literal('SINGLE_TARGET'),
    dispositionKind: z.enum(['ANY', 'WILLING', 'HOSTILE']).optional(),
    excludedCreatureTypeIds: z.array(z.string()).optional()
  }),
  z.object({
    selectionKind: z.literal('CHOSEN_CREATURES'),
    dispositionKind: z.enum(['ANY', 'WILLING', 'HOSTILE']).optional(),
    maxTargets: z.number().int().positive().optional(),
    maxTargetsScaling: createBreakpointScalingDtoSchema(z.object({
      amount: z.number().int().positive()
    })).optional(),
    excludedCreatureTypeIds: z.array(z.string()).optional()
  }),
  z.object({
    selectionKind: z.literal('AREA_CONTENTS'),
    dispositionKind: z.enum(['ANY', 'WILLING', 'HOSTILE']).optional(),
    excludedCreatureTypeIds: z.array(z.string()).optional()
  })
])

export type TargetingDto = z.infer<typeof targetingDtoSchema>
