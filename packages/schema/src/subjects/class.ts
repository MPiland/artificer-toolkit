import { z } from 'zod'

import {
  classHitpointDtoSchema,
  classMulticlassDtoSchema,
  classPrepareLimitDtoSchema,
  classResourceDtoSchema,
  classSpellLimitDtoSchema,
  classStartingGoldDtoSchema,
  classSpecializationDtoSchema,
} from './shared.js'
import {
  abilityCodeSchema,
  authoredRecordStatusSchema,
  chargeDtoSchema,
  detailDtoSchema,
  startingEquipmentDtoSchema
} from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'
import { proficiencyGrantDtoSchema } from '../grants/index.js'

const classBaseDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  status: authoredRecordStatusSchema.optional(),
  details: z.array(detailDtoSchema).optional(),
  proficiencies: z.array(proficiencyGrantDtoSchema).optional(),
  spellcasting: z.object({
    spellLimits: z.array(classSpellLimitDtoSchema),
    magicName: z.string().optional(),
    ability: abilityCodeSchema.optional(),
    maxSpellLevel: z.number().int(),
    attributes: z.array(z.string()).optional(),
    charges: chargeDtoSchema,
    prepareLimit: classPrepareLimitDtoSchema.optional()
  }).optional(),
  resources: classResourceDtoSchema.optional(),
  features: z.array(featureDtoSchema).optional(),
  userId: z.string(),
  systemId: z.string()
})

const parentClassAuthoredDtoSchemaRaw = classBaseDtoSchema.extend({
  category: z.literal('BASE'),
  attributes: z.array(z.string()).optional(),
  startingGold: classStartingGoldDtoSchema,
  startingEquipment: startingEquipmentDtoSchema,
  hitpoint: classHitpointDtoSchema,
  multiclass: classMulticlassDtoSchema
})

const subclassAuthoredDtoSchemaRaw = classBaseDtoSchema.extend({
  category: z.literal('SUBCLASS'),
  attributes: z.array(z.string()).optional(),
  parentClassId: z.string(),
  specializations: z.array(classSpecializationDtoSchema).optional()
})

const classAuthoredDtoSchemaRaw: z.ZodTypeAny = z.union([
  parentClassAuthoredDtoSchemaRaw,
  subclassAuthoredDtoSchemaRaw
])

export type ParentClassAuthoredDto = z.infer<typeof parentClassAuthoredDtoSchemaRaw>
export type SubclassAuthoredDto = z.infer<typeof subclassAuthoredDtoSchemaRaw>
export type ClassAuthoredDto = ParentClassAuthoredDto | SubclassAuthoredDto
const parentClassAuthoredDtoSchemaBase: z.ZodTypeAny = parentClassAuthoredDtoSchemaRaw
const subclassAuthoredDtoSchemaBase: z.ZodTypeAny = subclassAuthoredDtoSchemaRaw
const classAuthoredDtoSchemaBase: z.ZodTypeAny = classAuthoredDtoSchemaRaw
export const parentClassAuthoredDtoSchema = parentClassAuthoredDtoSchemaBase
export const subclassAuthoredDtoSchema = subclassAuthoredDtoSchemaBase
export const classAuthoredDtoSchema = classAuthoredDtoSchemaBase
