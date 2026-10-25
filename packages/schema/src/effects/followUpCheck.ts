import { convexOpaqueSchema, z } from '../zod.js'

import { activationDtoSchema } from './activation.js'
import { abilityCodeSchema } from '../shared/enums.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'

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
    ability: abilityCodeSchema,
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
