import { z } from 'zod'

import { activationDtoSchema } from './effect.js'
import { abilityCodeSchema } from '../shared/enums.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'

export function createFollowUpCheckDtoSchema(outcomeDtoSchema: z.ZodTypeAny) {
  const branchDtoSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('END') }),
    z.object({ kind: z.literal('CONTINUE') }),
    z.object({
      kind: z.literal('OUTCOMES'),
      endCurrent: z.boolean(),
      resultKind: z.enum(['SINGLE', 'SEQUENCE']),
      outcomes: authoredNestedCollectionSchema(outcomeDtoSchema)
    })
  ])

  return z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('FOLLOW_UP_CHECK'),
    label: authoredShortTextSchema,
    activation: activationDtoSchema,
    ability: abilityCodeSchema,
    fixedDc: z.number().int().positive(),
    skillId: authoredIdentifierSchema.optional(),
    toolEquipmentId: authoredIdentifierSchema.optional(),
    actorKinds: authoredNestedCollectionSchema(z.enum(['TARGET', 'CREATURE_WITHIN_REACH'])).min(1),
    repeatable: z.boolean(),
    onSuccess: branchDtoSchema,
    onFailure: branchDtoSchema
  })
}
