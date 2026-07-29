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
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  status: authoredRecordStatusSchema.optional(),
  details: z.array(detailDtoSchema).optional(),
  proficiencies: z.array(proficiencyGrantDtoSchema).optional(),
  spellcasting: z
    .object({
      spellLimits: z.array(classSpellLimitDtoSchema),
      availableAtLevel: z.number().int().optional(),
      order: z.number().int().optional(),
      details: z.array(detailDtoSchema).optional(),
      magicName: z.string().optional(),
      ability: abilityCodeSchema.optional(),
      maxSpellLevel: z.number().int(),
      attributes: z.array(spellcastingAttributeSchema).optional(),
      charges: chargeDtoSchema,
      prepareLimit: classPrepareLimitDtoSchema.optional()
    })
    .optional(),
  resources: classResourceDtoSchema.optional(),
  features: z.array(featureDtoSchema).optional(),
  userId: z.string(),
  systemId: z.string()
})

const parentClassAuthoredDtoSchemaRaw = classBaseDtoSchema.extend({
  category: z.literal('BASE'),
  attributes: z.array(classAttributeSchema).optional(),
  subclassSelectionLevel: z.number().int().min(1).max(20).optional(),
  startingGold: classStartingGoldDtoSchema,
  startingEquipment: startingEquipmentDtoSchema,
  hitpoint: classHitpointDtoSchema,
  multiclass: classMulticlassDtoSchema
})

const subclassAuthoredDtoSchemaRaw = classBaseDtoSchema.extend({
  category: z.literal('SUBCLASS'),
  attributes: z.array(subclassAttributeSchema).optional(),
  subclassSelectionLevel: z.never().optional(),
  parentClassId: z.string(),
  specializations: z.array(classSpecializationDtoSchema).optional()
})

const classAuthoredDtoSchemaRaw = z.union([
  parentClassAuthoredDtoSchemaRaw,
  subclassAuthoredDtoSchemaRaw
])

const classAuthoringInputDtoSchemaCommon = classBaseDtoSchema.extend({
  userId: z.string().optional(),
  startingGold: classStartingGoldDtoSchema.optional(),
  startingEquipment: startingEquipmentDtoSchema.optional(),
  hitpoint: classHitpointDtoSchema.optional(),
  multiclass: classMulticlassDtoSchema.optional(),
  parentClassId: z.string().optional(),
  specializations: z.array(classSpecializationDtoSchema).optional()
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
    attributes: z.array(classAttributeSchema).optional(),
    subclassSelectionLevel: z.number().int().min(1).max(20).optional()
  }),
  classAuthoringInputDtoSchemaCommon.extend({
    category: z.literal('SUBCLASS'),
    attributes: z.array(subclassAttributeSchema).optional(),
    subclassSelectionLevel: z.never().optional()
  }),
  classAuthoringInputDtoSchemaCommon.extend({
    category: z.undefined().optional(),
    attributes: z.array(classAttributeSchema).optional(),
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
