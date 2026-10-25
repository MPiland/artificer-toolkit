import { convexOpaqueSchema, z } from '../zod.js'

import { activationDtoSchema } from './activation.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

export function createFollowUpCheckDtoSchema(outcomeDtoSchema: z.ZodMiniType) {
  const branchDtoSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('END') }),
    z.object({ kind: z.literal('CONTINUE') }),
    z.object({
      kind: z.literal('OUTCOMES'),
      endCurrent: z.boolean(),
      resultKind: z.enum(['SINGLE', 'SEQUENCE']),
      outcomes: authoredNestedCollectionSchema(convexOpaqueSchema(outcomeDtoSchema))
    })
  ])

  return z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('FOLLOW_UP_CHECK'),
    label: authoredShortTextSchema,
    activation: activationDtoSchema,
    ability: systemCoreCodeSchema,
    fixedDc: z.number().check(z.int()).check(z.positive()),
    skillId: z.optional(authoredIdentifierSchema),
    toolEquipmentId: z.optional(authoredIdentifierSchema),
    actorKinds: authoredNestedCollectionSchema(z.enum(['TARGET', 'CREATURE_WITHIN_REACH'])).check(
      z.minLength(1)
    ),
    repeatable: z.boolean(),
    onSuccess: branchDtoSchema,
    onFailure: branchDtoSchema
  })
}
