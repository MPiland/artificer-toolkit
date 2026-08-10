import { z } from 'zod'
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
    modifiers: authoredNestedCollectionSchema(modifierGrantDtoSchema).optional(),
    proficiencies: authoredNestedCollectionSchema(proficiencyGrantDtoSchema).optional(),
    senses: authoredNestedCollectionSchema(senseGrantDtoSchema).optional()
  })
})

export type ApplyGrantDto = z.infer<typeof applyGrantDtoSchema>
