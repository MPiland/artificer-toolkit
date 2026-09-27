import { z, lazySchema } from '../zod.js'

import { castingTimeDtoSchema } from './castingTime.js'
import { effectDtoSchema } from '../effects/effect.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import {
  authoredRecordStatusSchema,
  spellAttributeSchema,
  spellComponentSchema
} from '../shared/enums.js'

export const spellAuthoredDtoSchema = lazySchema(() =>
  z.object({
    kind: z.literal('SPELL'),
    id: authoredIdentifierSchema,
    label: authoredShortTextSchema,
    status: z.optional(authoredRecordStatusSchema),
    attributes: z.optional(authoredReferenceCollectionSchema(spellAttributeSchema)),
    components: z.optional(authoredReferenceCollectionSchema(spellComponentSchema)),
    description: authoredRichTextSchema,
    castingTime: castingTimeDtoSchema,
    effects: z.optional(authoredNestedCollectionSchema(effectDtoSchema)),
    level: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9)),
    classIds: authoredReferenceCollectionSchema(authoredIdentifierSchema),
    magicSchoolId: authoredIdentifierSchema,
    materialDescription: z.optional(authoredRichTextSchema),
    userId: authoredIdentifierSchema,
    systemId: authoredIdentifierSchema
  })
)

export type SpellAuthoredDto = z.infer<typeof spellAuthoredDtoSchema>

export const spellAuthoringInputDtoSchema = lazySchema(() =>
  z.extend(spellAuthoredDtoSchema, {
    userId: z.optional(authoredIdentifierSchema)
  })
)

export type SpellAuthoringInputDto = z.infer<typeof spellAuthoringInputDtoSchema>
