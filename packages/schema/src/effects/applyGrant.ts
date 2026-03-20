import { z } from 'zod'
import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { senseGrantDtoSchema } from '../grants/sense.js'
import { spellGrantDtoSchema } from '../grants/spell.js'

export const applyGrantDtoSchema = z.object({
  id: z.string(),
  effectKind: z.literal('APPLY_GRANT'),
  grants: z.object({
    modifiers: z.array(modifierGrantDtoSchema).optional(),
    proficiencies: z.array(proficiencyGrantDtoSchema).optional(),
    senses: z.array(senseGrantDtoSchema).optional(),
    spells: z.array(spellGrantDtoSchema).optional()
  })
})

export type ApplyGrantDto = z.infer<typeof applyGrantDtoSchema>
