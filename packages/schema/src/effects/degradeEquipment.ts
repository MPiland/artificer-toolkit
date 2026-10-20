import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

const degradeEquipmentDestroyWhenDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.enum(['ARMOR_CLASS_OFFERED_AT_MOST', 'PENALTY_REACHES']),
    value: z.number().check(z.int()).check(z.nonnegative())
  })
)

export const degradeEquipmentDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('DEGRADE_EQUIPMENT'),
    category: z.enum(['ARMOR', 'SHIELD', 'WEAPON']),
    nonmagical: z.boolean(),
    materials: z.array(z.enum(['METAL', 'WOOD'])).check(z.maxLength(2)),
    step: z.number().check(z.int()).check(z.positive()),
    destroyWhen: degradeEquipmentDestroyWhenDtoSchema
  })
)

export type DegradeEquipmentDto = z.infer<typeof degradeEquipmentDtoSchema>
