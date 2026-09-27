import { z, lazySchema } from '../zod.js'

import { postgresUuidSchema } from '../shared/postgresUuid.js'

/**
 * How a hit point maximum reduction ends. Restoration magic always ends one; `LONG_REST` also ends
 * it when the target finishes a long rest (Life Drain, D62). Authored effects, active-effect
 * contributions and receipts share this definition.
 */
export const hitPointMaximumReductionRecoveryTagsSchema = lazySchema(() =>
  z
    .array(z.enum(['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']))
    .check(z.minLength(1))
    .check(z.maxLength(2))
    .check(
      z.superRefine((value, context) => {
        if (new Set(value).size !== value.length || !value.includes('RESTORE_HIT_POINT_MAXIMUM'))
          context.addIssue({
            code: 'custom',
            message:
              'Hit point maximum reduction recovery tags must be unique and include restoration.'
          })
      })
    )
)

export type HitPointMaximumReductionRecoveryTag = z.infer<
  typeof hitPointMaximumReductionRecoveryTagsSchema
>[number]

export const hitPointMaximumReductionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    effectKind: z.literal('HIT_POINT_MAXIMUM_REDUCTION'),
    amountSource: z.strictObject({
      kind: z.literal('DAMAGE_TAKEN'),
      damageOutcomeId: postgresUuidSchema
    }),
    recoveryTags: hitPointMaximumReductionRecoveryTagsSchema
  })
)

export type HitPointMaximumReductionDto = z.infer<typeof hitPointMaximumReductionDtoSchema>
