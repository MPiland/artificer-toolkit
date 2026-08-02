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
  // TODO(Phase 8+ interactive runtime):
  // Add optional temporary grant lifecycle once runtime supports expiry events.
  // Planned DTO extension (not active yet):
  // lifetime: {
  //   mode: 'PERMANENT' | 'TEMPORARY'
  //   lastsUntil:
  //     'NEXT_ATTACK' | 'END_OF_ROUND' | 'START_OF_NEXT_TURN' | 'END_OF_NEXT_TURN' | 'NEXT_SAVE'
  // }
  grants: z.object({
    modifiers: authoredNestedCollectionSchema(modifierGrantDtoSchema).optional(),
    proficiencies: authoredNestedCollectionSchema(proficiencyGrantDtoSchema).optional(),
    senses: authoredNestedCollectionSchema(senseGrantDtoSchema).optional()
  })
})

export type ApplyGrantDto = z.infer<typeof applyGrantDtoSchema>
