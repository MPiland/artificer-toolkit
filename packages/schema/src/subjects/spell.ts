import { z } from 'zod'

import { castingTimeDtoSchema } from './shared.js'
import { effectDtoSchema } from '../effects/index.js'
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

export const spellAuthoredDtoSchema = z.object({
  kind: z.literal('SPELL'),
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  status: authoredRecordStatusSchema.optional(),
  attributes: authoredReferenceCollectionSchema(spellAttributeSchema).optional(),
  components: authoredReferenceCollectionSchema(spellComponentSchema).optional(),
  description: authoredRichTextSchema,
  castingTime: castingTimeDtoSchema,
  effects: authoredNestedCollectionSchema(effectDtoSchema).optional(),
  level: z.number().int().min(0).max(9),
  classIds: authoredReferenceCollectionSchema(authoredIdentifierSchema),
  magicSchoolId: authoredIdentifierSchema,
  materialDescription: authoredRichTextSchema.optional(),
  userId: authoredIdentifierSchema,
  systemId: authoredIdentifierSchema
})

export type SpellAuthoredDto = z.infer<typeof spellAuthoredDtoSchema>

export const spellAuthoringInputDtoSchema = spellAuthoredDtoSchema.extend({
  userId: authoredIdentifierSchema.optional()
})

export type SpellAuthoringInputDto = z.infer<typeof spellAuthoringInputDtoSchema>
