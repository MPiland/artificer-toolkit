import { z } from 'zod'

import {
  classHitpointDtoSchema,
  classMulticlassDtoSchema,
  classPrepareLimitDtoSchema,
  classResourceDtoSchema,
  classSpellLimitDtoSchema,
  classStartingGoldDtoSchema,
  classSpecializationDtoSchema
} from './shared.js'
import {
  abilityCodeSchema,
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema,
  authoredRecordStatusSchema,
  chargeDtoSchema,
  classAttributeSchema,
  detailDtoSchema,
  spellcastingAttributeSchema,
  startingEquipmentDtoSchema
} from '../shared/index.js'
import { subclassAttributeSchema } from '../shared/enums.js'
import { featureDtoSchema } from '../features/index.js'
import { proficiencyGrantDtoSchema } from '../grants/index.js'

const classBaseDtoSchema = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: authoredRichTextSchema.optional(),
  status: authoredRecordStatusSchema.optional(),
  details: authoredNestedCollectionSchema(detailDtoSchema).optional(),
  proficiencies: authoredNestedCollectionSchema(proficiencyGrantDtoSchema).optional(),
  spellcasting: z
    .object({
      spellLimits: authoredNestedCollectionSchema(classSpellLimitDtoSchema),
      availableAtLevel: z.number().int().optional(),
      order: z.number().int().optional(),
      details: authoredNestedCollectionSchema(detailDtoSchema).optional(),
      magicName: authoredShortTextSchema.optional(),
      availableSpellIds: authoredReferenceCollectionSchema(authoredIdentifierSchema).optional(),
      ability: abilityCodeSchema.optional(),
      maxSpellLevel: z.number().int(),
      attributes: authoredReferenceCollectionSchema(spellcastingAttributeSchema).optional(),
      charges: chargeDtoSchema,
      prepareLimit: classPrepareLimitDtoSchema.optional()
    })
    .optional(),
  resources: classResourceDtoSchema.optional(),
  features: authoredNestedCollectionSchema(featureDtoSchema).optional(),
  userId: authoredIdentifierSchema,
  systemId: authoredIdentifierSchema
})

const parentClassAuthoredDtoSchemaRaw = classBaseDtoSchema.extend({
  category: z.literal('BASE'),
  attributes: authoredReferenceCollectionSchema(classAttributeSchema).optional(),
  subclassSelectionLevel: z.number().int().min(1).max(20).optional(),
  startingGold: classStartingGoldDtoSchema,
  startingEquipment: startingEquipmentDtoSchema,
  hitpoint: classHitpointDtoSchema,
  multiclass: classMulticlassDtoSchema
})

const subclassAuthoredDtoSchemaRaw = classBaseDtoSchema.extend({
  category: z.literal('SUBCLASS'),
  attributes: authoredReferenceCollectionSchema(subclassAttributeSchema).optional(),
  subclassSelectionLevel: z.never().optional(),
  parentClassId: authoredIdentifierSchema,
  specializations: authoredNestedCollectionSchema(classSpecializationDtoSchema).optional()
})

const classAuthoredDtoSchemaRaw = z.union([
  parentClassAuthoredDtoSchemaRaw,
  subclassAuthoredDtoSchemaRaw
])

const classAuthoringInputDtoSchemaCommon = classBaseDtoSchema.extend({
  userId: authoredIdentifierSchema.optional(),
  startingGold: classStartingGoldDtoSchema.optional(),
  startingEquipment: startingEquipmentDtoSchema.optional(),
  hitpoint: classHitpointDtoSchema.optional(),
  multiclass: classMulticlassDtoSchema.optional(),
  parentClassId: authoredIdentifierSchema.optional(),
  specializations: authoredNestedCollectionSchema(classSpecializationDtoSchema).optional()
})

export type ClassAuthoringInputDto = Omit<
  ParentClassAuthoredDto,
  | 'category'
  | 'attributes'
  | 'userId'
  | 'subclassSelectionLevel'
  | 'startingGold'
  | 'startingEquipment'
  | 'hitpoint'
  | 'multiclass'
> & {
  userId?: string
  startingGold?: ParentClassAuthoredDto['startingGold']
  startingEquipment?: ParentClassAuthoredDto['startingEquipment']
  hitpoint?: ParentClassAuthoredDto['hitpoint']
  multiclass?: ParentClassAuthoredDto['multiclass']
  parentClassId?: SubclassAuthoredDto['parentClassId']
  specializations?: SubclassAuthoredDto['specializations']
} & (
    | {
        category: 'BASE'
        attributes?: ParentClassAuthoredDto['attributes']
        subclassSelectionLevel?: ParentClassAuthoredDto['subclassSelectionLevel']
      }
    | {
        category: 'SUBCLASS'
        attributes?: SubclassAuthoredDto['attributes']
        subclassSelectionLevel?: never
      }
    | {
        category?: undefined
        attributes?: ParentClassAuthoredDto['attributes']
        subclassSelectionLevel?: ParentClassAuthoredDto['subclassSelectionLevel']
      }
  )

const classAuthoringInputDtoSchemaRaw: z.ZodType<ClassAuthoringInputDto> = z.union([
  classAuthoringInputDtoSchemaCommon.extend({
    category: z.literal('BASE'),
    attributes: authoredReferenceCollectionSchema(classAttributeSchema).optional(),
    subclassSelectionLevel: z.number().int().min(1).max(20).optional()
  }),
  classAuthoringInputDtoSchemaCommon.extend({
    category: z.literal('SUBCLASS'),
    attributes: authoredReferenceCollectionSchema(subclassAttributeSchema).optional(),
    subclassSelectionLevel: z.never().optional()
  }),
  classAuthoringInputDtoSchemaCommon.extend({
    category: z.undefined().optional(),
    attributes: authoredReferenceCollectionSchema(classAttributeSchema).optional(),
    subclassSelectionLevel: z.number().int().min(1).max(20).optional()
  })
])

export type ParentClassAuthoredDto = z.infer<typeof parentClassAuthoredDtoSchemaRaw>
export type SubclassAuthoredDto = z.infer<typeof subclassAuthoredDtoSchemaRaw>
export type ClassAuthoredDto = ParentClassAuthoredDto | SubclassAuthoredDto
export type ClassSpellcastingDto = NonNullable<ClassAuthoredDto['spellcasting']>
export const parentClassAuthoredDtoSchema: z.ZodType<ParentClassAuthoredDto> =
  parentClassAuthoredDtoSchemaRaw
export const subclassAuthoredDtoSchema: z.ZodType<SubclassAuthoredDto> =
  subclassAuthoredDtoSchemaRaw
export const classAuthoredDtoSchema: z.ZodType<ClassAuthoredDto> = classAuthoredDtoSchemaRaw
export const classAuthoringInputDtoSchema: z.ZodType<ClassAuthoringInputDto> =
  classAuthoringInputDtoSchemaRaw
