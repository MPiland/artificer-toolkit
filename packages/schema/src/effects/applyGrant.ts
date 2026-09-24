import { z } from '../zod.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'
import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { senseGrantDtoSchema } from '../grants/sense.js'

export const applyGrantDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal('APPLY_GRANT'),
  grants: z.object({
    modifiers: z.optional(authoredNestedCollectionSchema(modifierGrantDtoSchema)),
    proficiencies: z.optional(authoredNestedCollectionSchema(proficiencyGrantDtoSchema)),
    senses: z.optional(authoredNestedCollectionSchema(senseGrantDtoSchema))
  })
})

export type ApplyGrantDto = z.infer<typeof applyGrantDtoSchema>
