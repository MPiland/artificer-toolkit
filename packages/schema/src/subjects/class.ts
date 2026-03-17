import { z } from 'zod'

import {
  classHitpointDtoSchema,
  classMulticlassDtoSchema,
  classPrepareLimitDtoSchema,
  classResourceDtoSchema,
  classSpellLimitDtoSchema,
  classStartingGoldDtoSchema,
  classSubtypeDtoSchema,
} from './shared.js'
import {
  abilityCodeSchema,
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

export const parentClassAuthoredDtoSchema = classBaseDtoSchema.extend({
  category: z.literal('BASE'),
  attributes: z.array(z.string()).optional(),
  startingGold: classStartingGoldDtoSchema,
  startingEquipment: startingEquipmentDtoSchema,
  hitpoint: classHitpointDtoSchema,
  multiclass: classMulticlassDtoSchema
})

export const subclassAuthoredDtoSchema = classBaseDtoSchema.extend({
  category: z.literal('SUBCLASS'),
  attributes: z.array(z.string()).optional(),
  parentClassId: z.string(),
  subtypes: z.array(classSubtypeDtoSchema).optional()
})

export const classAuthoredDtoSchema = z.union([
  parentClassAuthoredDtoSchema,
  subclassAuthoredDtoSchema
])

export type ClassAuthoredDto = z.infer<typeof classAuthoredDtoSchema>
