import { z } from 'zod'

export const targetingDtoSchema = z.discriminatedUnion('selectionKind', [
  z.object({
    selectionKind: z.literal('SELF')
  }),
  z.object({
    selectionKind: z.enum(['SINGLE_TARGET', 'CHOSEN_CREATURES', 'AREA_CONTENTS']),
    dispositionKind: z.enum(['ANY', 'WILLING', 'HOSTILE']).optional(),
    maxTargets: z.number().int().positive().optional(),
    excludedCreatureTypeIds: z.array(z.string()).optional()
  })
])

export type TargetingDto = z.infer<typeof targetingDtoSchema>
