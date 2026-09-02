import { z } from 'zod'

import { postgresUuidSchema } from '../shared/postgresUuid.js'

export const hitPointMaximumReductionDtoSchema = z.strictObject({
  id: postgresUuidSchema,
  effectKind: z.literal('HIT_POINT_MAXIMUM_REDUCTION'),
  amountSource: z.strictObject({
    kind: z.literal('DAMAGE_TAKEN'),
    damageOutcomeId: postgresUuidSchema
  }),
  recoveryTags: z
    .array(z.literal('RESTORE_HIT_POINT_MAXIMUM'))
    .min(1)
    .max(1)
    .superRefine((value, context) => {
      if (value[0] !== 'RESTORE_HIT_POINT_MAXIMUM')
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Hit point maximum reduction recovery tags must be canonical.'
        })
    })
})

export type HitPointMaximumReductionDto = z.infer<typeof hitPointMaximumReductionDtoSchema>
